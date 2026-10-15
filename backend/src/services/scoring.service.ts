import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import {
  checkSetEnd,
  checkMatchEnd,
  rallyOutcome,
  setTransition,
  matchTransition,
  MatchStatus,
  SetStatus
} from '../fsm/match.fsm'
import { rotate, serializePositions, serializeLibero, courtView, RotationState, LiberoState } from './rotation.service'
import { stampWithin } from './set-version'
import { requirePermission } from './team-access'
import { lockSet } from './row-lock'
import { publishAll } from '../events/event-bus'
import {
  AnyDomainEvent,
  SCORE_UPDATED,
  SET_FINISHED,
  MATCH_FINISHED
} from '../events/domain-events'

export interface CompleteSetResult {
  ourSetsWon: number
  opponentSetsWon: number
  matchOver: boolean
  events: AnyDomainEvent[]
}


export const completeSetWithin = async (
  tx: Prisma.TransactionClient,
  set: {
    id: string
    matchId: string
    setNumber: number
    status: string
    ourScore: number
    opponentScore: number
  },
  matchStatus: string
): Promise<CompleteSetResult> => {
  const nextSetStatus = setTransition(set.status as SetStatus, 'END_SET', {
    ourScore: set.ourScore,
    opponentScore: set.opponentScore,
    setNumber: set.setNumber
  })

  await tx.matchSet.update({
    where: { id: set.id },
    data: { status: nextSetStatus }
  })

  const allSets = await tx.matchSet.findMany({
    where: { matchId: set.matchId }
  })

  const ourSetsWon = allSets.filter(
    s => s.status === 'finished' && s.ourScore > s.opponentScore
  ).length
  const opponentSetsWon = allSets.filter(
    s => s.status === 'finished' && s.opponentScore > s.ourScore
  ).length

  const matchOver = checkMatchEnd(ourSetsWon, opponentSetsWon)

  const events: AnyDomainEvent[] = [{
    name: SET_FINISHED,
    matchId: set.matchId,
    payload: {
      setNumber: set.setNumber,
      ourScore: set.ourScore,
      opponentScore: set.opponentScore,
      ourSetsWon,
      opponentSetsWon
    }
  }]

  if (matchOver) {
    const nextMatchStatus = matchTransition(matchStatus as MatchStatus, 'END_MATCH')
    await tx.match.update({
      where: { id: set.matchId },
      data: { status: nextMatchStatus, endedAt: new Date() }
    })

    events.push({
      name: MATCH_FINISHED,
      matchId: set.matchId,
      payload: {
        ourSetsWon,
        opponentSetsWon,
        winner: ourSetsWon > opponentSetsWon ? 'us' : 'opponent'
      }
    })
  }

  return { ourSetsWon, opponentSetsWon, matchOver, events }
}

export const scorePointWithin = async (
  tx: Prisma.TransactionClient,
  setId: string,
  userId: string,
  scorer: 'us' | 'opponent',
  opts: { sourceEventId?: string; clientEventId?: string } = {}
): Promise<{ result: ScorePointResult; events: AnyDomainEvent[] }> => {
  await lockSet(tx, setId)

  const set = await tx.matchSet.findUnique({
    where: { id: setId },
    include: {
      match: true,
      rotations: {
        orderBy: { recordedAt: 'desc' },
        take: 1
      }
    }
  })

  if (!set) throw new Error('SET_NOT_FOUND')
  if (set.status === 'finished') throw new Error('SET_FINISHED')

  await requirePermission(set.match.teamId, userId, 'match.code', tx)

  const pendingChallenge = await tx.challenge.findFirst({ where: { setId, successful: null } })
  if (pendingChallenge) throw new Error('CHALLENGE_PENDING')

  const newOurScore = scorer === 'us' ? set.ourScore + 1 : set.ourScore
  const newOppScore = scorer === 'opponent' ? set.opponentScore + 1 : set.opponentScore

  const lastRotation = set.rotations[0]
  const currentPositions = lastRotation.positions as any
  const currentServingTeam = set.servingTeam as 'us' | 'opponent'

  const currentState: RotationState = {
    positions: currentPositions,
    currentRotation: set.currentRotation,
    servingTeam: currentServingTeam,
    libero: (lastRotation.libero as LiberoState | null) ?? null
  }

  const { isSideOut, nextServingTeam: newServingTeam, rotatingTeam } = rallyOutcome(scorer, currentServingTeam)

  let newRotationState: RotationState = { ...currentState, servingTeam: newServingTeam }
  let newRotation = set.currentRotation
  let rotationId: string | undefined

  await tx.matchSet.update({
    where: { id: setId },
    data: {
      ourScore: newOurScore,
      opponentScore: newOppScore,
      servingTeam: newServingTeam
    }
  })

  //only track our own rotation, so only our side-outs move anyone.
  if (rotatingTeam === 'us') {
    newRotationState = rotate(newRotationState, newOurScore + newOppScore)
    newRotation = newRotationState.currentRotation

    const rotationRow = await tx.rotation.create({
      data: {
        setId,
        rotationNumber: newRotation,
        positions: serializePositions(newRotationState.positions),
        libero: serializeLibero(newRotationState.libero) as object,
        recordedAt: new Date()
      }
    })

    rotationId = rotationRow.id

    await tx.matchSet.update({
      where: { id: setId },
      data: { currentRotation: newRotation }
    })
  }

  // The rally was played in the rotation we were in before any side-out
  // rotation, so that is the rotation the point belongs to.
  const pointEvent = await tx.matchEvent.create({
    data: {
      setId,
      team: scorer,
      eventType: 'point',
      clientEventId: opts.clientEventId ?? null,
      outcome: 'scored',
      rotation: set.currentRotation,
      occurredAt: new Date(),
      payload: {
        ourScore: newOurScore,
        opponentScore: newOppScore,
        isSideOut,
        servingTeam: newServingTeam,
        before: {
          ourScore: set.ourScore,
          opponentScore: set.opponentScore,
          servingTeam: currentServingTeam,
          currentRotation: set.currentRotation
        },
        ...(rotationId ? { rotationId } : {}),
        ...(opts.sourceEventId ? { sourceEventId: opts.sourceEventId } : {})
      }
    }
  })

  const setOver = checkSetEnd(newOurScore, newOppScore, set.setNumber)
  let matchOver = false
  let ourSetsWon = 0
  let opponentSetsWon = 0
  let setEvents: AnyDomainEvent[] = []

  if (setOver) {
    const completed = await completeSetWithin(
      tx,
      { ...set, ourScore: newOurScore, opponentScore: newOppScore },
      set.match.status
    )
    matchOver = completed.matchOver
    ourSetsWon = completed.ourSetsWon
    opponentSetsWon = completed.opponentSetsWon
    setEvents = completed.events
  }

  const result = {
    ourScore: newOurScore,
    opponentScore: newOppScore,
    currentRotation: newRotation,
    rotationState: newRotationState,
    isSideOut,
    servingTeam: newServingTeam,
    setOver,
    matchOver,
    ourSetsWon,
    opponentSetsWon
  }

  const events: AnyDomainEvent[] = [
    {
      name: SCORE_UPDATED,
      matchId: set.matchId,
      payload: {
        ...result,
        setNumber: set.setNumber,
        scorer,
        clientEventId: opts.clientEventId ?? null,
        event: {
          id: pointEvent.id,
          team: pointEvent.team,
          eventType: pointEvent.eventType,
          outcome: pointEvent.outcome,
          rotation: pointEvent.rotation,
          occurredAt: pointEvent.occurredAt,
          payload: pointEvent.payload
        },
        currentPositions: courtView(newRotationState),
        rotationOrder: newRotationState.positions,
        libero: newRotationState.libero?.onCourt ?? null
      }
    },
    ...setEvents
  ]

  return { result, events }
}

export interface ScorePointResult {
  ourScore: number
  opponentScore: number
  currentRotation: number
  rotationState: RotationState
  isSideOut: boolean
  servingTeam: 'us' | 'opponent'
  setOver: boolean
  matchOver: boolean
  ourSetsWon: number
  opponentSetsWon: number
}

/**
 * Score a point as a standalone operation, in its own transaction.
 */
export interface DuplicatePointResult {
  duplicate: true
  ourScore: number
  opponentScore: number
  servingTeam: string
  currentRotation: number
}

export const scorePoint = async (
  setId: string,
  userId: string,
  scorer: 'us' | 'opponent',
  clientEventId?: string
): Promise<ScorePointResult | DuplicatePointResult> => {
  const { result, events } = await prisma.$transaction(async (tx) => {
    if (clientEventId) {
      const existing = await tx.matchEvent.findUnique({ where: { clientEventId } })
      if (existing) {
        const current = await tx.matchSet.findUniqueOrThrow({ where: { id: setId } })
        const duplicate: DuplicatePointResult = {
          duplicate: true,
          ourScore: current.ourScore,
          opponentScore: current.opponentScore,
          servingTeam: current.servingTeam,
          currentRotation: current.currentRotation
        }
        return { result: duplicate, events: [] as AnyDomainEvent[] }
      }
    }
    const scored = await scorePointWithin(tx, setId, userId, scorer, { clientEventId })
    return { result: scored.result, events: await stampWithin(tx, setId, scored.events) }
  }, { timeout: 15000 })

  publishAll(events)

  return result
}
