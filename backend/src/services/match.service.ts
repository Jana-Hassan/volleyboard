import prisma from '../lib/prisma'
import {
  matchTransition,
  checkMatchEnd,
  firstServerForSet,
  serverOfRally,
  MatchStatus,
  Team
} from '../fsm/match.fsm'
import {
  initializeRotation,
  serializePositions,
  serializeLibero,
  rotationStateFromRow,
  courtView
} from './rotation.service'
import { requirePermission } from './team-access'
import { validateLineupSlots } from './lineup.service'
import { lockMatch, lockSet } from './row-lock'
import { completeSetWithin } from './scoring.service'
import { stampWithin } from './set-version'
import { publish, publishAll } from '../events/event-bus'
import {
  MATCH_STARTED,
  NEXT_SET_STARTED,
  MATCH_ENDED
} from '../events/domain-events'
export { scorePoint } from './scoring.service'

export const getMatches = async (teamId: string, userId: string) => {
  await requirePermission(teamId, userId, 'team.view')

  return prisma.match.findMany({
    where: { teamId },
    include: {
      lineup: true,
      sets: {
        orderBy: { setNumber: 'asc' }
      }
    },
    orderBy: { scheduledAt: 'desc' }
  })
}

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
  await requirePermission(teamId, userId, 'match.schedule')

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

// Until the match page has a toss picker, a missing toss result means we
// serve first, which is what the app always did before.
const DEFAULT_TOSS: Team = 'us'

// Lineups saved before the libero rules (e.g. a libero among the six starters)
// must be fixed before a set can start from them.
const assertLineupPlayable = (teamId: string, lineup: { rotationSystem: string; slots: { playerId: string; role: string; rotationPosition: number | null }[] }) =>
  validateLineupSlots(
    teamId,
    lineup.slots.map(s => ({ playerId: s.playerId, role: s.role, rotationPosition: s.rotationPosition })),
    lineup.rotationSystem
  )

const firstServerOfSet = async (setId: string): Promise<Team> => {
  const firstPoint = await prisma.matchEvent.findFirst({
    where: { setId, eventType: 'point' },
    orderBy: { occurredAt: 'asc' }
  })
  if (!firstPoint) throw new Error('PREVIOUS_SET_NOT_FINISHED')
  return serverOfRally(firstPoint.payload as { servingTeam: Team; isSideOut: boolean })
}

export const startMatch = async (matchId: string, userId: string, toss?: Team) => {
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
  await requirePermission(match.teamId, userId, 'match.run')

  // Fail fast outside the transaction; re-checked under the lock below.
  matchTransition(match.status as MatchStatus, 'START_MATCH')

  await assertLineupPlayable(match.teamId, match.lineup)

  const servingTeam = firstServerForSet(1, { toss: toss ?? DEFAULT_TOSS })
  const starters = match.lineup.slots.filter(s => s.role === 'starter')

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
    await lockMatch(tx, matchId)
    const current = await tx.match.findUniqueOrThrow({ where: { id: matchId } })
    const newMatchStatus = matchTransition(current.status as MatchStatus, 'START_MATCH')

    const updatedMatch = await tx.match.update({
      where: { id: matchId },
      data: { status: newMatchStatus, startedAt: new Date() }
    })

    const firstSet = await tx.matchSet.create({
      data: {
        matchId,
        setNumber: 1,
        status: 'active',
        servingTeam
      }
    })

    await tx.rotation.create({
      data: {
        setId: firstSet.id,
        rotationNumber: 1,
        positions: serializePositions(rotationState.positions),
        libero: serializeLibero(rotationState.libero) as object
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
  await requirePermission(match.teamId, userId, 'team.view')

  const activeSet = match.sets.find(s => s.status === 'active') ?? null

  const ourSetsWon = match.sets.filter(
    s => s.status === 'finished' && s.ourScore > s.opponentScore
  ).length

  const opponentSetsWon = match.sets.filter(
    s => s.status === 'finished' && s.opponentScore > s.ourScore
  ).length

  const matchOver = checkMatchEnd(ourSetsWon, opponentSetsWon)

  const latestRotation = activeSet?.rotations[0]
  const rotationState = activeSet && latestRotation ? rotationStateFromRow(latestRotation, activeSet) : null

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
    // What is on court (libero applied); rotationOrder is the official six.
    currentPositions: rotationState ? courtView(rotationState) : null,
    rotationOrder: rotationState?.positions ?? null,
    libero: rotationState?.libero?.onCourt ?? null,
    sets: match.sets
  }
}

export const endSet = async (setId: string, userId: string) => {
  const set = await prisma.matchSet.findUnique({
    where: { id: setId },
    include: { match: true }
  })

  if (!set) throw new Error('SET_NOT_FOUND')
  await requirePermission(set.match.teamId, userId, 'match.run')

  const { updatedSet, events } = await prisma.$transaction(async (tx) => {
    await lockSet(tx, setId)
    const current = await tx.matchSet.findUniqueOrThrow({
      where: { id: setId },
      include: { match: true }
    })
    if (current.status === 'finished') throw new Error('SET_FINISHED')

    const completed = await completeSetWithin(tx, current, current.match.status)
    const events = await stampWithin(tx, setId, completed.events)
    const updatedSet = await tx.matchSet.findUniqueOrThrow({ where: { id: setId } })
    return { updatedSet, events }
  })

  publishAll(events)

  return { set: updatedSet }
}

export const startNextSet = async (matchId: string, userId: string, toss?: Team) => {
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
  await requirePermission(match.teamId, userId, 'match.run')

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

  await assertLineupPlayable(match.teamId, match.lineup)

  const nextSetNumber = lastSet.setNumber + 1
  const starters = match.lineup.slots.filter(s => s.role === 'starter')
  const servingTeam = firstServerForSet(nextSetNumber, {
    toss: toss ?? DEFAULT_TOSS,
    previousSetFirstServer: await firstServerOfSet(lastSet.id)
  })

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
    // Two taps on "Start next set" must not create the same set twice.
    await lockMatch(tx, matchId)
    const latest = await tx.matchSet.findFirst({
      where: { matchId },
      orderBy: { setNumber: 'desc' }
    })
    if (!latest || latest.id !== lastSet.id || latest.status !== 'finished') {
      throw new Error('PREVIOUS_SET_NOT_FINISHED')
    }

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
        positions: serializePositions(rotationState.positions),
        libero: serializeLibero(rotationState.libero) as object
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
  await requirePermission(match.teamId, userId, 'match.run')

  const updatedMatch = await prisma.$transaction(async (tx) => {
    await lockMatch(tx, matchId)
    const current = await tx.match.findUniqueOrThrow({ where: { id: matchId } })
    const newStatus = matchTransition(current.status as MatchStatus, 'END_MATCH')

    return tx.match.update({
      where: { id: matchId },
      data: { status: newStatus, endedAt: new Date() }
    })
  })

  publish(MATCH_ENDED, matchId, {
    matchId,
    status: 'completed'
  })

  return updatedMatch
}