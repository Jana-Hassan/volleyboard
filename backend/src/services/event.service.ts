import prisma from '../lib/prisma'
import { VALID_OUTCOMES } from '../lib/volleyball.constants'
import { aggregatePlayers, skillLine, ATTACK_ZONES, StatEvent } from '../lib/stats'
import { scorePointWithin } from './scoring.service'
import { requirePermission } from './team-access'
import { assertLiberoMayPerform } from '../fsm/match.fsm'
import { lockSet } from './row-lock'
import { publishAll } from '../events/event-bus'
import { AnyDomainEvent, EVENT_LOGGED, EventLoggedPayload } from '../events/domain-events'
import { stampWithin } from './set-version'

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
    clientEventId?: string
    zone?: number
  }
) => {
  const set = await prisma.matchSet.findUnique({
    where: { id: setId },
    include: { match: { include: { team: true } } }
  })

  if (!set) throw new Error('SET_NOT_FOUND')
  if (set.status === 'finished') throw new Error('SET_FINISHED')

  await requirePermission(set.match.teamId, userId, 'match.code')

  const validOutcomes = VALID_OUTCOMES[data.eventType]
  if (!validOutcomes) throw new Error('INVALID_EVENT_TYPE')
  if (!validOutcomes.includes(data.outcome)) throw new Error('INVALID_OUTCOME')
  if (data.zone !== undefined && (data.eventType !== 'attack' || !ATTACK_ZONES.includes(data.zone))) throw new Error('INVALID_ZONE')

  if (data.team === 'us' && data.playerId) {
    const player = await prisma.player.findFirst({
      where: { id: data.playerId, teamId: set.match.teamId }
    })
    if (!player) throw new Error('PLAYER_NOT_FOUND')
    if (player.isLibero) assertLiberoMayPerform(data.eventType)
  }

  if (data.team === 'opponent' && data.opponentPlayerId) {
    const opponentPlayer = await prisma.opponentPlayer.findFirst({
      where: { id: data.opponentPlayerId, matchId: set.matchId }
    })
    if (!opponentPlayer) throw new Error('OPPONENT_PLAYER_NOT_FOUND')
  }

  const POINT_FOR_ACTOR = ['kill', 'ace']
  const POINT_FOR_OPPONENT = ['error']

  let scored: 'us' | 'opponent' | null = null

  if (POINT_FOR_ACTOR.includes(data.outcome)) {
    scored = data.team
  } else if (POINT_FOR_OPPONENT.includes(data.outcome)) {
    scored = data.team === 'us' ? 'opponent' : 'us'
  }

  const { event, events, duplicate } = await prisma.$transaction(async (tx) => {
    await lockSet(tx, setId)
    const current = await tx.matchSet.findUniqueOrThrow({ where: { id: setId } })
    if (current.status === 'finished') throw new Error('SET_FINISHED')
    const pendingChallenge = await tx.challenge.findFirst({ where: { setId, successful: null } })
    if (pendingChallenge) throw new Error('CHALLENGE_PENDING')

    if (data.clientEventId) {
      const existing = await tx.matchEvent.findUnique({
        where: { clientEventId: data.clientEventId },
        include: { player: true, opponentPlayer: true }
      })
      if (existing) return { event: existing, events: [] as AnyDomainEvent[], duplicate: true }
    }

    const event = await tx.matchEvent.create({
      data: {
        setId,
        clientEventId: data.clientEventId ?? null,
        team: data.team,
        eventType: data.eventType,
        outcome: data.outcome,
        playerId: data.playerId ?? null,
        opponentPlayerId: data.opponentPlayerId ?? null,
        rotation: data.rotation ?? current.currentRotation,
        payload: data.zone !== undefined ? { zone: data.zone } : {},
        occurredAt: new Date()
      },
      include: {
        player: true,
        opponentPlayer: true
      }
    })

    const logged: AnyDomainEvent = {
      name: EVENT_LOGGED,
      matchId: set.matchId,
      payload: { setId, event, clientEventId: data.clientEventId ?? null, scored }
    }
    const pointEvents = scored
      ? (await scorePointWithin(tx, setId, userId, scored, { sourceEventId: event.id })).events
      : []
    const events = await stampWithin(tx, setId, [logged, ...pointEvents])
    return { event, events, duplicate: false }
  }, { timeout: 15000 })

  const liveStats = await calculateLiveStats(setId, set.matchId)

  if (events.length > 0) {
    (events[0].payload as EventLoggedPayload).liveStats = liveStats
    publishAll(events)
  }

  const version = (events[events.length - 1]?.payload as { version?: number } | undefined)?.version
  return { event, liveStats, scored: duplicate ? null : scored, duplicate, version }
}

export const getLiveStatsForSet = async (setId: string, userId: string) => {
  const set = await prisma.matchSet.findUnique({
    where: { id: setId },
    select: { matchId: true, match: { select: { teamId: true } } }
  })

  if (!set) throw new Error('SET_NOT_FOUND')
  await requirePermission(set.match.teamId, userId, 'team.view')

  return calculateLiveStats(setId, set.matchId)
}

export const getSetEvents = async (setId: string, userId: string) => {
  const set = await prisma.matchSet.findUnique({
    where: { id: setId },
    include: { match: true }
  })

  if (!set) throw new Error('SET_NOT_FOUND')
  await requirePermission(set.match.teamId, userId, 'team.view')

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

export const calculateLiveStats = async (_setId: string, matchId: string) => {
  const events = await prisma.matchEvent.findMany({
    where: {
      set: { matchId },
      eventType: { in: ['attack', 'serve', 'reception', 'block', 'dig', 'set'] }
    },
    include: { player: true, opponentPlayer: true },
    orderBy: { occurredAt: 'asc' }
  })

  const statEvents: StatEvent[] = events.map(e => ({
    id: e.id,
    team: e.team,
    eventType: e.eventType,
    outcome: e.outcome,
    playerId: e.playerId,
    playerName: e.player?.name ?? null,
    rotation: e.rotation,
    payload: e.payload
  }))

  const opponentIds = [...new Set(events.filter(e => e.team === 'opponent' && e.opponentPlayerId).map(e => e.opponentPlayerId as string))]

  return {
    players: aggregatePlayers(statEvents),
    opponent: opponentIds.map(opponentPlayerId => {
      const op = events.find(e => e.opponentPlayerId === opponentPlayerId)!.opponentPlayer!
      return {
        opponentPlayerId,
        jersey: op.jersey,
        name: op.name,
        ...skillLine(statEvents.filter((e, idx) => events[idx].opponentPlayerId === opponentPlayerId))
      }
    }).sort((a, b) => a.jersey - b.jersey)
  }
}
