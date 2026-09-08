import prisma from '../lib/prisma'
import { checkSetEnd, checkMatchEnd, determineSideOut } from '../fsm/match.fsm'
import { rotate, serializePositions, RotationState } from './rotation.service'
import { checkMembership } from './team-access'
import { publish } from '../events/event-bus'
import { SCORE_UPDATED, SET_FINISHED, MATCH_FINISHED } from '../events/domain-events'

/**
 * Scoring lives below both match.service and event.service so that the two can
 * share it without importing each other. This is a command, not a notification:
 * callers depend on it completing (or throwing) before they return.
 */
export const scorePoint = async (
  setId: string,
  userId: string,
  scorer: 'us' | 'opponent'
) => {
  const set = await prisma.matchSet.findUnique({
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

  await checkMembership(set.match.teamId, userId)

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

  const result = await prisma.$transaction(async (tx) => {
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

    return {
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
  })

  publish(SCORE_UPDATED, set.matchId, {
    ourScore: result.ourScore,
    opponentScore: result.opponentScore,
    currentRotation: result.currentRotation,
    rotationState: result.rotationState,
    isSideOut: result.isSideOut,
    servingTeam: result.servingTeam,
    setOver: result.setOver,
    matchOver: result.matchOver,
    ourSetsWon: result.ourSetsWon,
    opponentSetsWon: result.opponentSetsWon
  })

  if (result.setOver) {
    publish(SET_FINISHED, set.matchId, {
      setNumber: set.setNumber,
      ourScore: result.ourScore,
      opponentScore: result.opponentScore,
      ourSetsWon: result.ourSetsWon,
      opponentSetsWon: result.opponentSetsWon
    })
  }

  if (result.matchOver) {
    publish(MATCH_FINISHED, set.matchId, {
      ourSetsWon: result.ourSetsWon,
      opponentSetsWon: result.opponentSetsWon,
      winner: result.ourSetsWon === 3 ? 'us' : 'opponent'
    })
  }

  return result
}
