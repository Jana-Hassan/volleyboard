import prisma from '../lib/prisma'
import { VALID_OUTCOMES } from '../lib/volleyball.constants'
import { scorePoint } from './match.service'

const checkMembership = async (teamId: string, userId: string): Promise<void> => {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  })
  if (!member) throw new Error('FORBIDDEN')
}

const checkAnalystOrCoach = async (teamId: string, userId: string): Promise<void> => {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  })
  if (!member) throw new Error('FORBIDDEN')
  if (!['manager', 'coach', 'analyst'].includes(member.role)) {
    throw new Error('FORBIDDEN')
  }
}

export const logEvent = async (
  setId: string,
  userId: string,
  data: {
    team: 'us' | 'opponent'
    eventType: string
    outcome: string
    playerId?: string
    opponentPlayerId?: string
    rotation?: number
  }
) => {
  const set = await prisma.matchSet.findUnique({
    where: { id: setId },
    include: { match: { include: { team: true } } }
  })

  if (!set) throw new Error('SET_NOT_FOUND')
  if (set.status === 'finished') throw new Error('SET_FINISHED')

  await checkAnalystOrCoach(set.match.teamId, userId)

  const validOutcomes = VALID_OUTCOMES[data.eventType]
  if (!validOutcomes) throw new Error('INVALID_EVENT_TYPE')
  if (!validOutcomes.includes(data.outcome)) throw new Error('INVALID_OUTCOME')

  if (data.team === 'us' && data.playerId) {
    const player = await prisma.player.findFirst({
      where: { id: data.playerId, teamId: set.match.teamId }
    })
    if (!player) throw new Error('PLAYER_NOT_FOUND')
  }

  if (data.team === 'opponent' && data.opponentPlayerId) {
    const opponentPlayer = await prisma.opponentPlayer.findFirst({
      where: { id: data.opponentPlayerId, matchId: set.matchId }
    })
    if (!opponentPlayer) throw new Error('OPPONENT_PLAYER_NOT_FOUND')
  }

  const event = await prisma.matchEvent.create({
    data: {
      setId,
      team: data.team,
      eventType: data.eventType,
      outcome: data.outcome,
      playerId: data.playerId ?? null,
      opponentPlayerId: data.opponentPlayerId ?? null,
      rotation: data.rotation ?? set.currentRotation,
      payload: {}
    },
    include: {
      player: true,
      opponentPlayer: true
    }
  })

  const liveStats = await calculateLiveStats(setId, set.matchId)

  // point-scoring outcomes
  const POINT_FOR_ACTOR = ['kill', 'ace']
  const POINT_FOR_OPPONENT = ['error']

  let scored: 'us' | 'opponent' | null = null

  if (POINT_FOR_ACTOR.includes(data.outcome)) {
    scored = data.team
  } else if (POINT_FOR_OPPONENT.includes(data.outcome)) {
    scored = data.team === 'us' ? 'opponent' : 'us'
  }

  if (scored) {
    await scorePoint(setId, userId, scored)
  }

  return { event, liveStats, scored }
}

export const getSetEvents = async (setId: string, userId: string) => {
  const set = await prisma.matchSet.findUnique({
    where: { id: setId },
    include: { match: true }
  })

  if (!set) throw new Error('SET_NOT_FOUND')
  await checkMembership(set.match.teamId, userId)

  const events = await prisma.matchEvent.findMany({
    where: { setId },
    include: {
      player: true,
      opponentPlayer: true
    },
    orderBy: { occurredAt: 'asc' }
  })

  return events
}

export const calculateLiveStats = async (setId: string, matchId: string) => {
  const events = await prisma.matchEvent.findMany({
    where: {
      set: { matchId },
      eventType: { in: ['attack', 'serve', 'reception', 'block', 'dig', 'set'] }
    },
    include: { player: true }
  })

  const playerStats: Record<string, any> = {}

  for (const event of events) {
    if (event.team !== 'us' || !event.playerId) continue

    const pid = event.playerId
    if (!playerStats[pid]) {
      playerStats[pid] = {
        playerId: pid,
        playerName: event.player?.name ?? 'Unknown',
        attack:    { total: 0, kills: 0, errors: 0, efficiency: 0 },
        serve:     { total: 0, aces: 0, errors: 0, efficiency: 0 },
        reception: { total: 0, perfect: 0, good: 0, errors: 0, efficiency: 0 },
        block:     { total: 0, kills: 0, errors: 0, touches: 0 },
        dig:       { total: 0, perfect: 0, good: 0, errors: 0 },
        set:       { total: 0, perfect: 0, good: 0, errors: 0 },
        totalPoints: 0
      }
    }

    const stats = playerStats[pid]

    switch (event.eventType) {
      case 'attack':
        stats.attack.total++
        if (event.outcome === 'kill') { stats.attack.kills++; stats.totalPoints++ }
        if (event.outcome === 'error') stats.attack.errors++
        stats.attack.efficiency = stats.attack.total > 0
          ? (stats.attack.kills - stats.attack.errors) / stats.attack.total
          : 0
        break

      case 'serve':
        stats.serve.total++
        if (event.outcome === 'ace') { stats.serve.aces++; stats.totalPoints++ }
        if (event.outcome === 'error') stats.serve.errors++
        stats.serve.efficiency = stats.serve.total > 0
          ? stats.serve.aces / stats.serve.total
          : 0
        break

      case 'reception':
        stats.reception.total++
        if (event.outcome === 'perfect') stats.reception.perfect++
        if (event.outcome === 'good') stats.reception.good++
        if (event.outcome === 'error') stats.reception.errors++
        stats.reception.efficiency = stats.reception.total > 0
          ? (stats.reception.perfect + stats.reception.good * 0.5) / stats.reception.total
          : 0
        break

      case 'block':
        stats.block.total++
        if (event.outcome === 'kill') { stats.block.kills++; stats.totalPoints++ }
        if (event.outcome === 'error') stats.block.errors++
        if (event.outcome === 'touch') stats.block.touches++
        break

      case 'dig':
        stats.dig.total++
        if (event.outcome === 'perfect') stats.dig.perfect++
        if (event.outcome === 'good') stats.dig.good++
        if (event.outcome === 'error') stats.dig.errors++
        break

      case 'set':
        stats.set.total++
        if (event.outcome === 'perfect') stats.set.perfect++
        if (event.outcome === 'good') stats.set.good++
        if (event.outcome === 'error') stats.set.errors++
        break
    }
  }

  const opponentStats = calculateOpponentStats(
    events.filter(e => e.team === 'opponent')
  )

  return {
    players: Object.values(playerStats),
    opponent: opponentStats
  }
}

const calculateOpponentStats = (events: any[]) => {
  const playerStats: Record<string, any> = {}

  for (const event of events) {
    if (!event.opponentPlayerId) continue

    const pid = event.opponentPlayerId
    if (!playerStats[pid]) {
      playerStats[pid] = {
        opponentPlayerId: pid,
        attack:    { total: 0, kills: 0, errors: 0, efficiency: 0 },
        serve:     { total: 0, aces: 0, errors: 0, efficiency: 0 },
        reception: { total: 0, perfect: 0, good: 0, errors: 0, efficiency: 0 },
        totalPoints: 0
      }
    }

    const stats = playerStats[pid]

    switch (event.eventType) {
      case 'attack':
        stats.attack.total++
        if (event.outcome === 'kill') { stats.attack.kills++; stats.totalPoints++ }
        if (event.outcome === 'error') stats.attack.errors++
        stats.attack.efficiency = stats.attack.total > 0
          ? (stats.attack.kills - stats.attack.errors) / stats.attack.total
          : 0
        break

      case 'serve':
        stats.serve.total++
        if (event.outcome === 'ace') { stats.serve.aces++; stats.totalPoints++ }
        if (event.outcome === 'error') stats.serve.errors++
        break

      case 'reception':
        stats.reception.total++
        if (event.outcome === 'perfect') stats.reception.perfect++
        if (event.outcome === 'good') stats.reception.good++
        if (event.outcome === 'error') stats.reception.errors++
        stats.reception.efficiency = stats.reception.total > 0
          ? (stats.reception.perfect + stats.reception.good * 0.5) / stats.reception.total
          : 0
        break
    }
  }

  return Object.values(playerStats)
}