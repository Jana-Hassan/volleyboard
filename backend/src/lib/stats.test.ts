import { describe, it, expect } from 'vitest'
import { aggregatePlayers, aggregateTeam, pointProgression, rotationEfficiency, attackZones, StatEvent } from './stats'

let n = 0
const ev = (over: Partial<StatEvent>): StatEvent => ({
  id: `e${++n}`, team: 'us', eventType: 'attack', outcome: 'kill', playerId: 'P1', playerName: 'Ishikawa', rotation: 1, payload: {}, ...over
})
const point = (team: 'us' | 'opponent', rotation: number, ourScore: number, opponentScore: number) =>
  ev({ eventType: 'point', outcome: 'scored', team, rotation, playerId: null, playerName: null, payload: { ourScore, opponentScore } })

describe('player stats', () => {
  it('attack efficiency is (kills - errors) / attempts', () => {
    const [p] = aggregatePlayers([ev({}), ev({}), ev({ outcome: 'error' }), ev({ outcome: 'in_play' })])
    expect(p.attack).toEqual({ total: 4, kills: 2, errors: 1, efficiency: 0.25 })
  })

  it('serve efficiency is aces / serves; points count kills, aces and block kills', () => {
    const [p] = aggregatePlayers([ev({ eventType: 'serve', outcome: 'ace' }), ev({ eventType: 'serve', outcome: 'in_play' }), ev({ eventType: 'block', outcome: 'kill' }), ev({})])
    expect(p.serve.efficiency).toBe(0.5)
    expect(p.totalPoints).toBe(3)
  })

  it('reception efficiency counts perfect as 1 and good as half', () => {
    const [p] = aggregatePlayers([ev({ eventType: 'reception', outcome: 'perfect' }), ev({ eventType: 'reception', outcome: 'good' }), ev({ eventType: 'reception', outcome: 'error' }), ev({ eventType: 'reception', outcome: 'error' })])
    expect(p.reception.efficiency).toBe(0.375)
  })

  it('one row per player, opponent and point events ignored', () => {
    const rows = aggregatePlayers([ev({}), ev({ playerId: 'P2', playerName: 'Nishida' }), ev({ team: 'opponent', playerId: null }), point('us', 1, 1, 0)])
    expect(rows.map(r => r.playerId).sort()).toEqual(['P1', 'P2'])
  })
})

describe('team totals', () => {
  it('adds up one side, including events with no player', () => {
    const t = aggregateTeam([ev({ team: 'opponent', playerId: null }), ev({ team: 'opponent', playerId: null, outcome: 'error' }), ev({ team: 'opponent', playerId: null, eventType: 'serve', outcome: 'ace' }), ev({})], 'opponent')
    expect(t.attack).toEqual({ total: 2, kills: 1, errors: 1, efficiency: 0 })
    expect(t.serve.aces).toBe(1)
    expect(t.totalPoints).toBe(2)
  })
})

describe('point progression', () => {
  it('the score after every rally, starting at 0-0', () => {
    expect(pointProgression([point('us', 1, 1, 0), point('opponent', 1, 1, 1), point('opponent', 1, 1, 2)])).toEqual([
      { rally: 0, us: 0, them: 0 },
      { rally: 1, us: 1, them: 0 },
      { rally: 2, us: 1, them: 1 },
      { rally: 3, us: 1, them: 2 }
    ])
  })
})

describe('rotation efficiency', () => {
  it('rallies won and lost in each rotation', () => {
    const rows = rotationEfficiency([point('us', 1, 1, 0), point('opponent', 1, 1, 1), point('us', 4, 2, 1)])
    expect(rows[0]).toEqual({ rotation: 1, won: 1, lost: 1, net: 0 })
    expect(rows[3]).toEqual({ rotation: 4, won: 1, lost: 0, net: 1 })
    expect(rows).toHaveLength(6)
  })
})

describe('attack zones', () => {
  it('counts our attacks by the zone they were hit from, with kills, errors and efficiency', () => {
    const zones = attackZones([
      ev({ payload: { zone: 4 } }), ev({ payload: { zone: 4 } }), ev({ outcome: 'error', payload: { zone: 4 } }),
      ev({ outcome: 'in_play', payload: { zone: 2 } }),
      ev({ payload: { zone: 6 } })
    ])
    expect(zones.find(z => z.zone === 4)).toEqual({ zone: 4, attempts: 3, kills: 2, errors: 1, efficiency: 1 / 3 })
    expect(zones.find(z => z.zone === 2)).toEqual({ zone: 2, attempts: 1, kills: 0, errors: 0, efficiency: 0 })
    expect(zones.find(z => z.zone === 3)).toEqual({ zone: 3, attempts: 0, kills: 0, errors: 0, efficiency: 0 })
  })

  it('always returns the six zones in court order', () => {
    expect(attackZones([]).map(z => z.zone)).toEqual([4, 3, 2, 5, 6, 1])
  })

  it('ignores attacks without a zone, opponent attacks and other skills', () => {
    const zones = attackZones([ev({}), ev({ team: 'opponent', payload: { zone: 4 } }), ev({ eventType: 'serve', outcome: 'ace', payload: { zone: 4 } })])
    expect(zones.every(z => z.attempts === 0)).toBe(true)
  })
})
