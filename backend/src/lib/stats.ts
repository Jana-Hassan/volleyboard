export interface StatEvent {
  id: string
  team: string
  eventType: string
  outcome: string
  playerId: string | null
  playerName: string | null
  rotation: number | null
  payload: unknown
}

export interface SkillLine {
  attack: { total: number; kills: number; errors: number; efficiency: number }
  serve: { total: number; aces: number; errors: number; efficiency: number }
  reception: { total: number; perfect: number; good: number; errors: number; efficiency: number }
  block: { total: number; kills: number; errors: number; touches: number }
  dig: { total: number; perfect: number; good: number; errors: number }
  set: { total: number; perfect: number; good: number; errors: number }
  totalPoints: number
}

export interface PlayerLine extends SkillLine {
  playerId: string
  playerName: string
}

const SKILL_TYPES = ['attack', 'serve', 'reception', 'block', 'dig', 'set']

const ratio = (a: number, b: number) => (b ? a / b : 0)

export const skillLine = (events: StatEvent[]): SkillLine => {
  const of = (type: string) => events.filter(e => e.eventType === type)
  const count = (list: StatEvent[], outcome: string) => list.filter(e => e.outcome === outcome).length
  const atk = of('attack'), srv = of('serve'), rec = of('reception'), blk = of('block'), dig = of('dig'), set = of('set')
  return {
    attack: { total: atk.length, kills: count(atk, 'kill'), errors: count(atk, 'error'), efficiency: ratio(count(atk, 'kill') - count(atk, 'error'), atk.length) },
    serve: { total: srv.length, aces: count(srv, 'ace'), errors: count(srv, 'error'), efficiency: ratio(count(srv, 'ace'), srv.length) },
    reception: { total: rec.length, perfect: count(rec, 'perfect'), good: count(rec, 'good'), errors: count(rec, 'error'), efficiency: ratio(count(rec, 'perfect') + count(rec, 'good') * 0.5, rec.length) },
    block: { total: blk.length, kills: count(blk, 'kill'), errors: count(blk, 'error'), touches: count(blk, 'touch') },
    dig: { total: dig.length, perfect: count(dig, 'perfect'), good: count(dig, 'good'), errors: count(dig, 'error') },
    set: { total: set.length, perfect: count(set, 'perfect'), good: count(set, 'good'), errors: count(set, 'error') },
    totalPoints: count(atk, 'kill') + count(srv, 'ace') + count(blk, 'kill')
  }
}

const coded = (events: StatEvent[]) => events.filter(e => SKILL_TYPES.includes(e.eventType))

export const aggregatePlayers = (events: StatEvent[]): PlayerLine[] => {
  const ours = coded(events).filter(e => e.team === 'us' && e.playerId)
  const ids = [...new Set(ours.map(e => e.playerId as string))]
  return ids.map(playerId => {
    const mine = ours.filter(e => e.playerId === playerId)
    return { playerId, playerName: mine[0].playerName ?? 'Unknown', ...skillLine(mine) }
  })
}

export const aggregateTeam = (events: StatEvent[], team: 'us' | 'opponent'): SkillLine =>
  skillLine(coded(events).filter(e => e.team === team))

export const pointProgression = (events: StatEvent[]) => {
  const points = events.filter(e => e.eventType === 'point')
  return [
    { rally: 0, us: 0, them: 0 },
    ...points.map((e, i) => {
      const p = (e.payload ?? {}) as { ourScore?: number; opponentScore?: number }
      return { rally: i + 1, us: p.ourScore ?? 0, them: p.opponentScore ?? 0 }
    })
  ]
}

export const rotationEfficiency = (events: StatEvent[]) =>
  [1, 2, 3, 4, 5, 6].map(rotation => {
    const rallies = events.filter(e => e.eventType === 'point' && e.rotation === rotation)
    const won = rallies.filter(e => e.team === 'us').length
    return { rotation, won, lost: rallies.length - won, net: 2 * won - rallies.length }
  })

export const ATTACK_ZONES = [4, 3, 2, 5, 6, 1]

export const attackZones = (events: StatEvent[]) => {
  const attacks = events.filter(e => e.team === 'us' && e.eventType === 'attack')
  const zoneOf = (e: StatEvent) => (e.payload as { zone?: number } | null)?.zone
  return ATTACK_ZONES.map(zone => {
    const here = attacks.filter(e => zoneOf(e) === zone)
    const kills = here.filter(e => e.outcome === 'kill').length
    const errors = here.filter(e => e.outcome === 'error').length
    return { zone, attempts: here.length, kills, errors, efficiency: ratio(kills - errors, here.length) }
  })
}
