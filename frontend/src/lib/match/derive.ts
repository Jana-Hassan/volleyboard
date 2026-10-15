import type { PlayerStats } from '../../types'
import type { Court, LiveEvent, LivePlayer, LiveSnapshot, LiveSubstitution, Team } from './types'
import { eventLabel } from './labels'

const POINT_FOR_ACTOR = ['kill', 'ace']
const POINT_FOR_OPPONENT = ['error']

type PointPayload = { ourScore?: number; opponentScore?: number; sourceEventId?: string }

const isPoint = (e: LiveEvent) => e.eventType === 'point'
const payloadOf = (e: LiveEvent) => (e.payload ?? {}) as PointPayload
const scoreOf = (e: LiveEvent) => `${payloadOf(e).ourScore ?? 0}–${payloadOf(e).opponentScore ?? 0}`

export const scorerOf = (team: Team | string, outcome: string): Team | null => {
  if (POINT_FOR_ACTOR.includes(outcome)) return team as Team
  if (POINT_FOR_OPPONENT.includes(outcome)) return team === 'us' ? 'opponent' : 'us'
  return null
}

export interface RotationRow {
  rotation: number
  won: number
  lost: number
  net: number
}

export const rotationEfficiency = (events: LiveEvent[]): RotationRow[] =>
  [1, 2, 3, 4, 5, 6].map(rotation => {
    const rallies = events.filter(e => isPoint(e) && e.rotation === rotation)
    const won = rallies.filter(e => e.team === 'us').length
    const lost = rallies.length - won
    return { rotation, won, lost, net: won - lost }
  })

export interface Momentum {
  rallies: Team[]
  run: { team: Team; length: number } | null
}

export const momentum = (events: LiveEvent[], size = 10): Momentum => {
  const teams = events.filter(isPoint).map(e => e.team as Team)
  if (teams.length === 0) return { rallies: [], run: null }
  const last = teams[teams.length - 1]
  let length = 0
  for (let i = teams.length - 1; i >= 0 && teams[i] === last; i--) length++
  return { rallies: teams.slice(-size), run: { team: last, length } }
}

export interface RotationStint {
  rotation: number
  score: string | null
  current: boolean
}

export const rotationStints = (events: LiveEvent[], currentRotation: number): RotationStint[] => {
  const stints: RotationStint[] = []
  for (const e of events.filter(isPoint)) {
    const last = stints[stints.length - 1]
    if (last && last.rotation === e.rotation) last.score = scoreOf(e)
    else stints.push({ rotation: e.rotation ?? currentRotation, score: scoreOf(e), current: false })
  }
  const last = stints[stints.length - 1]
  if (last && last.rotation === currentRotation) last.current = true
  else stints.push({ rotation: currentRotation, score: null, current: true })
  return stints
}

export interface FeedEntry {
  id: string
  team: Team
  score: string | null
  label: string
  pending: boolean
}

export const pointFeed = (events: LiveEvent[], players: LivePlayer[]): FeedEntry[] => {
  const byId = new Map(events.map(e => [e.id, e]))
  const entries: FeedEntry[] = []
  for (const e of events) {
    if (isPoint(e)) {
      const source = payloadOf(e).sourceEventId ? byId.get(payloadOf(e).sourceEventId!) : undefined
      entries.push({
        id: e.id,
        team: e.team as Team,
        score: scoreOf(e),
        label: source ? eventLabel(source, players) : 'Point',
        pending: false
      })
    } else if (e.pending) {
      const team = scorerOf(e.team, e.outcome)
      if (team) entries.push({ id: e.id, team, score: null, label: eventLabel(e, players), pending: true })
    }
  }
  return entries.reverse()
}

export const effBar = (s: PlayerStats): number | null => {
  const total = s.attack.total + s.serve.total + s.reception.total + s.block.total + s.dig.total + s.set.total
  if (total === 0) return null
  const good = s.attack.kills + s.serve.aces + s.block.kills + s.reception.perfect + s.dig.perfect + s.set.perfect
  const bad = s.attack.errors + s.serve.errors + s.block.errors + s.reception.errors + s.dig.errors + s.set.errors
  return Math.max(0, Math.min(1, (good - bad) / total))
}

export type Skill = 'ATK' | 'SRV' | 'REC' | 'BLK'

export interface PlayerEfficiency {
  skill: Skill
  value: number
  tone: 'low' | 'mid' | 'high'
  trend: 'up' | 'down' | 'flat' | null
}

const SKILLS: { skill: Skill; eventType: string; total: (s: PlayerStats) => number; value: (s: PlayerStats) => number }[] = [
  { skill: 'ATK', eventType: 'attack', total: s => s.attack.total, value: s => s.attack.efficiency },
  { skill: 'SRV', eventType: 'serve', total: s => s.serve.total, value: s => s.serve.efficiency },
  { skill: 'REC', eventType: 'reception', total: s => s.reception.total, value: s => s.reception.efficiency },
  { skill: 'BLK', eventType: 'block', total: s => s.block.total, value: s => (s.block.total ? s.block.kills / s.block.total : 0) }
]

const GOOD = ['kill', 'ace', 'perfect']
const BAD = ['error', 'blocked']

export const playerEfficiency = (stats: PlayerStats, events: LiveEvent[]): PlayerEfficiency | null => {
  const best = SKILLS.reduce<typeof SKILLS[number] | null>(
    (top, s) => (s.total(stats) > (top ? top.total(stats) : 0) ? s : top),
    null
  )
  if (!best) return null
  const value = best.value(stats)
  const recent = events
    .filter(e => !isPoint(e) && e.playerId === stats.playerId && e.eventType === best.eventType)
    .slice(-3)
  const sum = recent.reduce((acc, e) => acc + (GOOD.includes(e.outcome) ? 1 : BAD.includes(e.outcome) ? -1 : 0), 0)
  return {
    skill: best.skill,
    value,
    tone: value < 0.3 ? 'low' : value > 0.6 ? 'high' : 'mid',
    trend: recent.length === 0 ? null : sum > 0 ? 'up' : sum < 0 ? 'down' : 'flat'
  }
}

export interface BenchEntry {
  playerId: string
  kind: 'bench' | 'starter' | 'libero'
  status: 'available' | 'on' | 'used' | 'returns' | 'done'
  pairId?: string
}

type Lineup = LiveSnapshot['lineup']

const idsWithRole = (lineup: Lineup, role: string) => lineup.slots.filter(s => s.role === role).map(s => s.playerId)

export const benchStatus = (lineup: Lineup, subs: LiveSubstitution[], court: Court | null): BenchEntry[] => {
  const onCourt = new Set(Object.values(court?.rotationOrder ?? {}).map(p => p.playerId))
  const entered = new Set(subs.map(s => s.playerInId))
  const starters = idsWithRole(lineup, 'starter')

  const bench: BenchEntry[] = idsWithRole(lineup, 'bench').map(playerId => ({
    playerId,
    kind: 'bench',
    status: onCourt.has(playerId) ? 'on' : entered.has(playerId) ? 'used' : 'available'
  }))

  const offStarters: BenchEntry[] = starters
    .filter(id => !onCourt.has(id))
    .map(playerId => {
      const pair = subs.find(s => s.playerOutId === playerId)?.playerInId
      const returned = subs.some(s => s.playerInId === playerId)
      return { playerId, kind: 'starter', status: returned ? 'done' : 'returns', pairId: pair }
    })

  const liberos: BenchEntry[] = idsWithRole(lineup, 'libero').map(playerId => ({
    playerId,
    kind: 'libero',
    status: court?.libero?.liberoId === playerId ? 'on' : 'available'
  }))

  return [...offStarters, ...bench, ...liberos]
}

export const subOutCandidates = (court: Court | null): string[] =>
  [1, 2, 3, 4, 5, 6]
    .map(pos => court?.rotationOrder[String(pos)]?.playerId)
    .filter((id): id is string => Boolean(id) && id !== court?.libero?.replacedPlayerId)

export const subOptions = (playerOutId: string, lineup: Lineup, subs: LiveSubstitution[], court: Court | null): string[] => {
  const starters = idsWithRole(lineup, 'starter')
  const onCourt = new Set(Object.values(court?.rotationOrder ?? {}).map(p => p.playerId))
  const enteredFor = subs.find(s => s.playerInId === playerOutId && starters.includes(s.playerOutId))
  if (enteredFor) return [enteredFor.playerOutId]
  if (!starters.includes(playerOutId) || subs.some(s => s.playerOutId === playerOutId)) return []
  const entered = new Set(subs.map(s => s.playerInId))
  return idsWithRole(lineup, 'bench').filter(id => !onCourt.has(id) && !entered.has(id))
}

export const liberoTargets = (court: Court | null, servingTeam: Team): string[] => {
  if (!court || court.libero) return []
  const positions = servingTeam === 'opponent' ? [1, 5, 6] : [5, 6]
  return positions.map(p => court.rotationOrder[String(p)]?.playerId).filter((id): id is string => Boolean(id))
}

export const opponentTotals = (events: LiveEvent[]): PlayerStats => teamTotals(events, 'opponent')

export const teamTotals = (events: LiveEvent[], team: Team): PlayerStats => {
  const opp = events.filter(e => e.team === team && !isPoint(e))
  const of = (type: string) => opp.filter(e => e.eventType === type)
  const count = (list: LiveEvent[], outcome: string) => list.filter(e => e.outcome === outcome).length
  const atk = of('attack'), srv = of('serve'), rec = of('reception'), blk = of('block'), dig = of('dig'), set = of('set')
  const ratio = (a: number, b: number) => (b ? a / b : 0)
  return {
    playerId: team,
    playerName: team === 'us' ? 'Us' : 'Opponent',
    attack: { total: atk.length, kills: count(atk, 'kill'), errors: count(atk, 'error'), efficiency: ratio(count(atk, 'kill') - count(atk, 'error'), atk.length) },
    serve: { total: srv.length, aces: count(srv, 'ace'), errors: count(srv, 'error'), efficiency: ratio(count(srv, 'ace'), srv.length) },
    reception: { total: rec.length, perfect: count(rec, 'perfect'), good: count(rec, 'good'), errors: count(rec, 'error'), efficiency: ratio(count(rec, 'perfect') + count(rec, 'good') * 0.5, rec.length) },
    block: { total: blk.length, kills: count(blk, 'kill'), errors: count(blk, 'error'), touches: count(blk, 'touch') },
    dig: { total: dig.length, perfect: count(dig, 'perfect'), good: count(dig, 'good'), errors: count(dig, 'error') },
    set: { total: set.length, perfect: count(set, 'perfect'), good: count(set, 'good'), errors: count(set, 'error') },
    totalPoints: count(atk, 'kill') + count(srv, 'ace') + count(blk, 'kill')
  }
}
