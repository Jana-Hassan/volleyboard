import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { checkSetEnd, checkMatchEnd, determineSideOut } from '../fsm/match.fsm'
import { rotate, serializePositions, RotationState } from './rotation.service'
import { checkMembership } from './team-access'
import { publishAll } from '../events/event-bus'
import {
  AnyDomainEvent,
  SCORE_UPDATED,
  SET_FINISHED,
  MATCH_FINISHED
} from '../events/domain-events'

export const scorePointWithin = async (
  tx: Prisma.TransactionClient,
  setId: string,
  userId: string,
  scorer: 'us' | 'opponent'
): Promise<{ result: ScorePointResult; events: AnyDomainEvent[] }> => {
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

  await checkMembership(set.match.teamId, userId, tx)

  const newOurScore = scorer === 'us' ? set.ourScore + 1 : set.ourScore
  const newOppScore = scorer === 'opponent' ? set.opponentScore + 1 : set.opponentScore

  const lastRotation = set.rotations[0]
  const currentPositions = lastRotation.positions as any
  const currentServingTeam = set.servingTeam as 'us' | 'opponent'

  const currentState: RotationState = {
    positions: currentPositions,
    currentRotation: set.currentRotation,
    servingTeam: currentServingTeam
  }

  const isSideOut = determineSideOut(scorer, currentServingTeam)
  const newServingTeam: 'us' | 'opponent' = scorer === 'us' ? 'us' : 'opponent'

  let newRotationState = currentState
  let newRotation = set.currentRotation

  await tx.matchSet.update({
    where: { id: setId },
    data: {
      ourScore: newOurScore,
      opponentScore: newOppScore,
      servingTeam: newServingTeam
    }
  })

  if (isSideOut) {
    newRotationState = rotate(currentState)
    newRotationState = { ...newRotationState, servingTeam: newServingTeam }
    newRotation = newRotationState.currentRotation

    await tx.rotation.create({
      data: {
        setId,
        rotationNumber: newRotation,
        positions: serializePositions(newRotationState.positions)
      }
    })

    await tx.matchSet.update({
      where: { id: setId },
      data: { currentRotation: newRotation }
    })
  }

  await tx.matchEvent.create({
    data: {
      setId,
      team: scorer,
      eventType: 'point',
      outcome: 'scored',
      rotation: newRotation,
      payload: {
        ourScore: newOurScore,
        opponentScore: newOppScore,
        isSideOut,
        servingTeam: newServingTeam
      }
    }
  })

  const setOver = checkSetEnd(newOurScore, newOppScore, set.setNumber)
  let matchOver = false
  let ourSetsWon = 0
  let opponentSetsWon = 0

  if (setOver) {
    await tx.matchSet.update({
      where: { id: setId },
      data: { status: 'finished' }
    })

    const allSets = await tx.matchSet.findMany({
      where: { matchId: set.matchId }
    })

    ourSetsWon = allSets.filter(
      s => s.status === 'finished' && s.ourScore > s.opponentScore
    ).length

    opponentSetsWon = allSets.filter(
      s => s.status === 'finished' && s.opponentScore > s.ourScore
    ).length

    matchOver = checkMatchEnd(ourSetsWon, opponentSetsWon)

    if (matchOver) {
      await tx.match.update({
        where: { id: set.matchId },
        data: { status: 'completed', endedAt: new Date() }
      })
    }
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
    { name: SCORE_UPDATED, matchId: set.matchId, payload: { ...result } }
  ]

  if (result.setOver) {
    events.push({
      name: SET_FINISHED,
      matchId: set.matchId,
      payload: {
        setNumber: set.setNumber,
        ourScore: result.ourScore,
        opponentScore: result.opponentScore,
        ourSetsWon: result.ourSetsWon,
        opponentSetsWon: result.opponentSetsWon
      }
    })
  }

  if (result.matchOver) {
    events.push({
      name: MATCH_FINISHED,
      matchId: set.matchId,
      payload: {
        ourSetsWon: result.ourSetsWon,
        opponentSetsWon: result.opponentSetsWon,
        winner: result.ourSetsWon === 3 ? 'us' : 'opponent'
      }
    })
  }

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
export const scorePoint = async (
  setId: string,
  userId: string,
  scorer: 'us' | 'opponent'
): Promise<ScorePointResult> => {
  const { result, events } = await prisma.$transaction(
    (tx) => scorePointWithin(tx, setId, userId, scorer),
    { timeout: 15000 }
  )

  publishAll(events)

  return result
}
