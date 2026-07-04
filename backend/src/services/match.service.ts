import prisma from '../lib/prisma'
import {
  matchTransition,
  setTransition,
  checkSetEnd,
  checkMatchEnd,
  determineSideOut,
  GuardError
} from '../fsm/match.fsm'
import {
  initializeRotation,
  rotate,
  validateOverlap,
  serializePositions,
  RotationState
} from './rotation.service'

const checkCoachOrManager = async (teamId: string, userId: string): Promise<void> => {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  })
  if (!member) throw new Error('FORBIDDEN')
  if (!['manager', 'coach'].includes(member.role)) throw new Error('FORBIDDEN')
}

const checkMembership = async (teamId: string, userId: string): Promise<void> => {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  })
  if (!member) throw new Error('FORBIDDEN')
}

export const createMatch = async (
  teamId: string,
  userId: string,
  data: { lineupId: string; opponentName: string }
) => {
  await checkCoachOrManager(teamId, userId)

  const lineup = await prisma.lineup.findFirst({
    where: { id: data.lineupId, teamId }
  })
  if (!lineup) throw new Error('LINEUP_NOT_FOUND')

  const match = await prisma.match.create({
    data: {
      teamId,
      lineupId: data.lineupId,
      opponentName: data.opponentName,
      status: 'pending'
    },
    include: {
      lineup: {
        include: {
          slots: {
            include: { player: true }
          }
        }
      }
    }
  })

  return match
}

export const startMatch = async (matchId: string, userId: string) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team: true,
      lineup: {
        include: {
          slots: {
            include: { player: true }
          }
        }
      }
    }
  })

  if (!match) throw new Error('MATCH_NOT_FOUND')
  await checkCoachOrManager(match.teamId, userId)

  const newMatchStatus = matchTransition(match.status as any, 'START_MATCH')

  const starters = match.lineup.slots.filter(s => s.role === 'starter')

  const rotationState = initializeRotation(
    starters.map(s => ({
      playerId: s.player.id,
      playerName: s.player.name,
      isLibero: s.player.isLibero,
      rotationPosition: s.rotationPosition!
    })),
    'us'
  )

  const result = await prisma.$transaction(async (tx) => {
    const updatedMatch = await tx.match.update({
      where: { id: matchId },
      data: { status: newMatchStatus, startedAt: new Date() }
    })

    const firstSet = await tx.matchSet.create({
      data: {
        matchId,
        setNumber: 1,
        status: 'active',
        servingTeam: 'us'
      }
    })

    await tx.rotation.create({
      data: {
        setId: firstSet.id,
        rotationNumber: 1,
        positions: serializePositions(rotationState.positions)
      }
    })

    return { match: updatedMatch, set: firstSet, rotationState }
  })

  return result
}

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

  return result
}

export const getMatchState = async (matchId: string, userId: string) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      team: true,
      lineup: {
        include: {
          slots: {
            include: { player: true },
            orderBy: { rotationPosition: 'asc' }
          }
        }
      },
      sets: {
        include: {
          rotations: {
            orderBy: { recordedAt: 'desc' },
            take: 1
          },
          substitutions: true,
          challenges: true,
          timeouts: true
        },
        orderBy: { setNumber: 'asc' }
      },
      opponentPlayers: true
    }
  })

  if (!match) throw new Error('MATCH_NOT_FOUND')
  await checkMembership(match.teamId, userId)

  const activeSet = match.sets.find(s => s.status === 'active') ?? null

  const ourSetsWon = match.sets.filter(
    s => s.status === 'finished' && s.ourScore > s.opponentScore
  ).length

  const opponentSetsWon = match.sets.filter(
    s => s.status === 'finished' && s.opponentScore > s.ourScore
  ).length

  const matchOver = checkMatchEnd(ourSetsWon, opponentSetsWon)

  return {
    matchId: match.id,
    status: match.status,
    opponentName: match.opponentName,
    ourSetsWon,
    opponentSetsWon,
    matchOver,
    activeSet,
    currentPositions: activeSet?.rotations[0]?.positions ?? null,
    sets: match.sets
  }
}

export const endSet = async (setId: string, userId: string) => {
  const set = await prisma.matchSet.findUnique({
    where: { id: setId },
    include: { match: true }
  })

  if (!set) throw new Error('SET_NOT_FOUND')
  await checkCoachOrManager(set.match.teamId, userId)

  setTransition('active', 'END_SET', {
    ourScore: set.ourScore,
    opponentScore: set.opponentScore,
    setNumber: set.setNumber
  })

  const updatedSet = await prisma.matchSet.update({
    where: { id: setId },
    data: { status: 'finished' }
  })

  return { set: updatedSet }
}

export const startNextSet = async (matchId: string, userId: string) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      sets: { orderBy: { setNumber: 'asc' } },
      lineup: {
        include: {
          slots: { include: { player: true } }
        }
      }
    }
  })

  if (!match) throw new Error('MATCH_NOT_FOUND')
  await checkCoachOrManager(match.teamId, userId)

  const lastSet = match.sets[match.sets.length - 1]
  if (!lastSet || lastSet.status !== 'finished') {
    throw new Error('PREVIOUS_SET_NOT_FINISHED')
  }

  const ourSetsWon = match.sets.filter(
    s => s.status === 'finished' && s.ourScore > s.opponentScore
  ).length

  const opponentSetsWon = match.sets.filter(
    s => s.status === 'finished' && s.opponentScore > s.ourScore
  ).length

  if (checkMatchEnd(ourSetsWon, opponentSetsWon)) {
    throw new Error('MATCH_ALREADY_OVER')
  }

  const nextSetNumber = lastSet.setNumber + 1

  const starters = match.lineup.slots.filter(s => s.role === 'starter')

  const weWonLastSet = lastSet.ourScore > lastSet.opponentScore
  const servingTeam: 'us' | 'opponent' = weWonLastSet ? 'us' : 'opponent'

  const rotationState = initializeRotation(
    starters.map(s => ({
      playerId: s.player.id,
      playerName: s.player.name,
      isLibero: s.player.isLibero,
      rotationPosition: s.rotationPosition!
    })),
    servingTeam
  )

  const result = await prisma.$transaction(async (tx) => {
    const newSet = await tx.matchSet.create({
      data: {
        matchId,
        setNumber: nextSetNumber,
        status: 'active',
        servingTeam
      }
    })

    await tx.rotation.create({
      data: {
        setId: newSet.id,
        rotationNumber: 1,
        positions: serializePositions(rotationState.positions)
      }
    })

    return { set: newSet, rotationState }
  })

  return result
}

export const endMatch = async (matchId: string, userId: string) => {
  const match = await prisma.match.findUnique({
    where: { id: matchId }
  })

  if (!match) throw new Error('MATCH_NOT_FOUND')
  await checkCoachOrManager(match.teamId, userId)

  const newStatus = matchTransition(match.status as any, 'END_MATCH')

  const updatedMatch = await prisma.match.update({
    where: { id: matchId },
    data: { status: newStatus, endedAt: new Date() }
  })

  return updatedMatch
}