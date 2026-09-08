import prisma from '../lib/prisma'
import {
  matchTransition,
  setTransition,
  checkSetEnd,
  checkMatchEnd,
  GuardError
} from '../fsm/match.fsm'
import {
  initializeRotation,
  serializePositions
} from './rotation.service'
import {
  checkManagerOrAssistant,
  checkCoachOrManager,
  checkMembership
} from './team-access'
import { publish } from '../events/event-bus'
import {
  MATCH_STARTED,
  NEXT_SET_STARTED,
  MATCH_ENDED
} from '../events/domain-events'

// scorePoint now lives in scoring.service so event.service can use it without
// importing this module. Re-exported so existing callers are unaffected.
export { scorePoint } from './scoring.service'

export const createMatch = async (
  teamId: string,
  userId: string,
  data: {
    lineupId: string
    opponentName: string
    competition?: string
    scheduledAt?: string
  }
) => {
  await checkManagerOrAssistant(teamId, userId)

  const lineup = await prisma.lineup.findFirst({
    where: { id: data.lineupId, teamId }
  })
  if (!lineup) throw new Error('LINEUP_NOT_FOUND')

  const match = await prisma.match.create({
    data: {
      teamId,
      lineupId: data.lineupId,
      opponentName: data.opponentName,
      competition: data.competition ?? 'Friendly',
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
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

  publish(MATCH_STARTED, matchId, {
    matchId,
    set: result.set,
    rotationState: result.rotationState
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
    teamId: match.teamId,
    teamName: match.team.name,
    status: match.status,
    opponentName: match.opponentName,
    competition: match.competition,
    scheduledAt: match.scheduledAt,
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

  publish(NEXT_SET_STARTED, matchId, {
    setNumber: nextSetNumber,
    servingTeam,
    rotationState: result.rotationState
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

  publish(MATCH_ENDED, matchId, {
    matchId,
    status: 'completed'
  })

  return updatedMatch
}