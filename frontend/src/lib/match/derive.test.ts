import { describe, it, expect } from 'vitest'
import {
  rotationEfficiency,
  momentum,
  rotationStints,
  pointFeed,
  effBar,
  playerEfficiency,
  benchStatus,
  subOptions,
  subOutCandidates,
  liberoTargets,
  opponentTotals
} from './derive'
import type { LiveEvent, LiveSubstitution, Court, LivePlayer } from './types'
import type { PlayerStats } from '../../types'

let n = 0
const point = (team: 'us' | 'opponent', rotation: number, ourScore: number, opponentScore: number, sourceEventId?: string): LiveEvent => ({
  id: `pt${++n}`, team, eventType: 'point', outcome: 'scored', rotation, occurredAt: `t${n}`,
  payload: { ourScore, opponentScore, ...(sourceEventId ? { sourceEventId } : {}) }
})
const coded = (over: Partial<LiveEvent>): LiveEvent => ({
  id: `ev${++n}`, team: 'us', eventType: 'attack', outcome: 'kill', playerId: 'P14', rotation: 1, occurredAt: `t${n}`, ...over
})

const players: LivePlayer[] = [
  { id: 'P14', name: 'Yuki Ishikawa', number: '14', position: 'outside', isLibero: false },
  { id: 'P1', name: 'Yuji Nishida', number: '1', position: 'opposite', isLibero: false },
  { id: 'L20', name: 'Yamamoto', number: '20', position: 'libero', isLibero: true }
]

const stats = (over: Partial<PlayerStats>): PlayerStats => ({
  playerId: 'P14', playerName: 'Yuki Ishikawa',
  attack: { total: 0, kills: 0, errors: 0, efficiency: 0 },
  serve: { total: 0, aces: 0, errors: 0, efficiency: 0 },
  reception: { total: 0, perfect: 0, good: 0, errors: 0, efficiency: 0 },
  block: { total: 0, kills: 0, errors: 0, touches: 0 },
  dig: { total: 0, perfect: 0, good: 0, errors: 0 },
  set: { total: 0, perfect: 0, good: 0, errors: 0 },
  totalPoints: 0,
  ...over
})

describe('rotation efficiency', () => {
  it('counts rallies won and lost in each of the six rotations', () => {
    const r = rotationEfficiency([point('us', 1, 1, 0), point('us', 1, 2, 0), point('opponent', 1, 2, 1), point('opponent', 3, 2, 2)])
    expect(r).toHaveLength(6)
    expect(r[0]).toEqual({ rotation: 1, won: 2, lost: 1, net: 1 })
    expect(r[2]).toEqual({ rotation: 3, won: 0, lost: 1, net: -1 })
    expect(r[4]).toEqual({ rotation: 5, won: 0, lost: 0, net: 0 })
  })

  it('ignores coded events that are not points', () => {
    expect(rotationEfficiency([coded({})]).every(r => r.won === 0 && r.lost === 0)).toBe(true)
  })
})

describe('momentum', () => {
  it('shows the last ten rallies oldest first and the current run', () => {
    const events = [point('opponent', 1, 0, 1), ...Array.from({ length: 11 }, (_, i) => point(i < 7 ? 'opponent' : 'us', 1, 0, 0))]
    const m = momentum(events)
    expect(m.rallies).toHaveLength(10)
    expect(m.rallies.slice(-4)).toEqual(['us', 'us', 'us', 'us'])
    expect(m.run).toEqual({ team: 'us', length: 4 })
  })

  it('no rallies yet: empty strip, no run', () => {
    expect(momentum([])).toEqual({ rallies: [], run: null })
  })
})

describe('rotation history', () => {
  it('lists each stretch in a rotation with the score when we left it', () => {
    const events = [point('us', 1, 1, 0), point('opponent', 1, 1, 1), point('us', 1, 2, 1), point('opponent', 2, 2, 2), point('us', 2, 3, 2)]
    expect(rotationStints(events, 3)).toEqual([
      { rotation: 1, score: '2–1', current: false },
      { rotation: 2, score: '3–2', current: false },
      { rotation: 3, score: null, current: true }
    ])
  })

  it('before any rally only the starting rotation is shown, as current', () => {
    expect(rotationStints([], 1)).toEqual([{ rotation: 1, score: null, current: true }])
  })

  it('the rotation still being played is current and shows the live score', () => {
    expect(rotationStints([point('us', 4, 1, 0), point('us', 4, 2, 0)], 4)).toEqual([{ rotation: 4, score: '2–0', current: true }])
  })
})

describe('point-by-point feed', () => {
  it('newest first, each point with its score and what won it', () => {
    const ace = coded({ eventType: 'serve', outcome: 'ace', playerId: 'P14' })
    const err = coded({ eventType: 'attack', outcome: 'error', playerId: 'P1' })
    const feed = pointFeed([ace, point('us', 1, 1, 0, ace.id), err, point('opponent', 1, 1, 1, err.id), point('us', 1, 2, 1)], players)
    expect(feed.map(f => [f.team, f.score, f.label])).toEqual([
      ['us', '2–1', 'Point'],
      ['opponent', '1–1', '#1 Nishida · Attack error'],
      ['us', '1–0', '#14 Ishikawa · Ace']
    ])
  })

  it('an opponent coded point says so', () => {
    const k = coded({ team: 'opponent', playerId: null, eventType: 'attack', outcome: 'kill' })
    expect(pointFeed([k, point('opponent', 1, 0, 1, k.id)], players)[0].label).toBe('Opponent · Kill')
  })

  it('a tapped scoring event shows straight away as pending, before its point arrives', () => {
    const f = pointFeed([coded({ id: 'c1', eventType: 'serve', outcome: 'ace', pending: true })], players)
    expect(f[0]).toMatchObject({ team: 'us', pending: true, score: null, label: '#14 Ishikawa · Ace' })
  })

  it('a tapped event that does not score is not a point', () => {
    expect(pointFeed([coded({ pending: true, eventType: 'reception', outcome: 'good' })], players)).toEqual([])
  })
})

describe('efficiency bar', () => {
  it('good actions minus errors over all actions', () => {
    expect(effBar(stats({ attack: { total: 10, kills: 6, errors: 1, efficiency: 0.5 }, reception: { total: 10, perfect: 5, good: 3, errors: 2, efficiency: 0.65 } }))).toBeCloseTo((6 + 5 - 1 - 2) / 20)
  })

  it('never below zero, nothing to show without actions', () => {
    expect(effBar(stats({ attack: { total: 2, kills: 0, errors: 2, efficiency: -1 } }))).toBe(0)
    expect(effBar(stats({}))).toBeNull()
  })
})

describe('live player efficiency (coach)', () => {
  it('uses the skill the player does most and its efficiency', () => {
    const e = playerEfficiency(stats({ attack: { total: 8, kills: 4, errors: 1, efficiency: 0.375 }, serve: { total: 3, aces: 1, errors: 0, efficiency: 0.33 } }), [])
    expect(e).toMatchObject({ skill: 'ATK', value: 0.375, tone: 'mid' })
  })

  it('below 30% is low (burgundy), above 60% is high (green)', () => {
    expect(playerEfficiency(stats({ reception: { total: 10, perfect: 8, good: 1, errors: 1, efficiency: 0.85 } }), [])?.tone).toBe('high')
    expect(playerEfficiency(stats({ serve: { total: 4, aces: 1, errors: 2, efficiency: 0.25 } }), [])?.tone).toBe('low')
  })

  it('the arrow follows the last three attempts at that skill', () => {
    const s = stats({ attack: { total: 5, kills: 2, errors: 1, efficiency: 0.2 } })
    const up = [coded({ outcome: 'error' }), coded({ outcome: 'kill' }), coded({ outcome: 'kill' }), coded({ outcome: 'in_play' })]
    const down = [coded({ outcome: 'kill' }), coded({ outcome: 'error' }), coded({ outcome: 'blocked' }), coded({ outcome: 'in_play' })]
    const flat = [coded({ outcome: 'kill' }), coded({ outcome: 'error' }), coded({ outcome: 'in_play' })]
    expect(playerEfficiency(s, up)?.trend).toBe('up')
    expect(playerEfficiency(s, down)?.trend).toBe('down')
    expect(playerEfficiency(s, flat)?.trend).toBe('flat')
  })

  it('only counts that player\'s attempts at that skill', () => {
    const s = stats({ attack: { total: 3, kills: 1, errors: 0, efficiency: 0.33 } })
    expect(playerEfficiency(s, [coded({ playerId: 'P1', outcome: 'error' }), coded({ eventType: 'serve', outcome: 'error' })])?.trend).toBeNull()
  })

  it('nothing to show for a player with no actions', () => {
    expect(playerEfficiency(stats({}), [])).toBeNull()
  })
})

const pos = (n: number, id: string, isLibero = false) => ({ playerId: id, playerName: id, isLibero, rotationPosition: n })
const courtOf = (ids: string[], libero: Court['libero'] = null): Court => {
  const order = Object.fromEntries(ids.map((id, i) => [String(i + 1), pos(i + 1, id)]))
  const current = { ...order }
  if (libero) {
    const slot = Object.keys(order).find(k => order[k].playerId === libero.replacedPlayerId)!
    current[slot] = pos(Number(slot), libero.liberoId, true)
  }
  return { currentPositions: current, rotationOrder: order, libero }
}
const lineup = {
  id: 'l', name: 'L', rotationSystem: '5-1',
  slots: [
    ...['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].map((playerId, i) => ({ playerId, role: 'starter', rotationPosition: i + 1 })),
    ...['B1', 'B2', 'B3'].map(playerId => ({ playerId, role: 'bench', rotationPosition: null })),
    { playerId: 'L1', role: 'libero', rotationPosition: null },
    { playerId: 'R1', role: 'reserved', rotationPosition: null }
  ]
}
const sub = (playerOutId: string, playerInId: string): LiveSubstitution => ({ playerOutId, playerInId, atScoreUs: 0, atScoreThem: 0 })

describe('bench (FIVB 15.6)', () => {
  it('bench players are available until they enter', () => {
    const b = benchStatus(lineup, [], courtOf(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']))
    expect(b.filter(x => x.kind === 'bench').map(x => `${x.playerId}:${x.status}`)).toEqual(['B1:available', 'B2:available', 'B3:available'])
  })

  it('a substitute on court is "on", a starter who left can come back only for them', () => {
    const b = benchStatus(lineup, [sub('S1', 'B1')], courtOf(['B1', 'S2', 'S3', 'S4', 'S5', 'S6']))
    expect(b.find(x => x.playerId === 'B1')?.status).toBe('on')
    expect(b.find(x => x.playerId === 'S1')).toMatchObject({ status: 'returns', pairId: 'B1' })
  })

  it('a substitute who went back off is used for the set', () => {
    const b = benchStatus(lineup, [sub('S1', 'B1'), sub('B1', 'S1')], courtOf(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']))
    expect(b.find(x => x.playerId === 'B1')?.status).toBe('used')
  })

  it('reserved players are not on the bench; liberos are listed separately', () => {
    const b = benchStatus(lineup, [], courtOf(['S1', 'S2', 'S3', 'S4', 'S5', 'S6'], { liberoId: 'L1', liberoName: 'L1', replacedPlayerId: 'S5' }))
    expect(b.some(x => x.playerId === 'R1')).toBe(false)
    expect(b.find(x => x.playerId === 'L1')).toMatchObject({ kind: 'libero', status: 'on' })
  })
})

describe('substitution choices (FIVB 15.6)', () => {
  const court = courtOf(['S1', 'S2', 'S3', 'S4', 'S5', 'S6'])
  it('a starter can go off for any bench player who has not played', () => {
    expect(subOptions('S1', lineup, [sub('S2', 'B2'), sub('B2', 'S2')], court)).toEqual(['B1', 'B3'])
  })

  it('a substitute can only go off for the starter they replaced', () => {
    expect(subOptions('B1', lineup, [sub('S1', 'B1')], courtOf(['B1', 'S2', 'S3', 'S4', 'S5', 'S6']))).toEqual(['S1'])
  })

  it('a starter who already left and came back has no options', () => {
    expect(subOptions('S1', lineup, [sub('S1', 'B1'), sub('B1', 'S1')], court)).toEqual([])
  })

  it('who can go off: the six in the rotation, except one who is off for the libero', () => {
    const withLibero = courtOf(['S1', 'S2', 'S3', 'S4', 'S5', 'S6'], { liberoId: 'L1', liberoName: 'L1', replacedPlayerId: 'S5' })
    expect(subOutCandidates(withLibero)).toEqual(['S1', 'S2', 'S3', 'S4', 'S6'])
  })
})

describe('libero targets (FIVB 19.3.2)', () => {
  const court = courtOf(['S1', 'S2', 'S3', 'S4', 'S5', 'S6'])
  it('back-row players at 5 and 6, and 1 only while the opponent serves', () => {
    expect(liberoTargets(court, 'opponent')).toEqual(['S1', 'S5', 'S6'])
    expect(liberoTargets(court, 'us')).toEqual(['S5', 'S6'])
  })

  it('no targets while a libero is already on', () => {
    expect(liberoTargets(courtOf(['S1', 'S2', 'S3', 'S4', 'S5', 'S6'], { liberoId: 'L1', liberoName: 'L1', replacedPlayerId: 'S5' }), 'opponent')).toEqual([])
  })
})

describe('opponent team totals', () => {
  it('adds up opponent coded events by skill', () => {
    const t = opponentTotals([
      coded({ team: 'opponent', playerId: null, eventType: 'attack', outcome: 'kill' }),
      coded({ team: 'opponent', playerId: null, eventType: 'attack', outcome: 'error' }),
      coded({ team: 'opponent', playerId: null, eventType: 'attack', outcome: 'in_play' }),
      coded({ team: 'opponent', playerId: null, eventType: 'serve', outcome: 'ace' }),
      coded({ team: 'opponent', playerId: null, eventType: 'reception', outcome: 'perfect' }),
      coded({ team: 'us', eventType: 'attack', outcome: 'kill' })
    ])
    expect(t.attack).toEqual({ total: 3, kills: 1, errors: 1, efficiency: 0 })
    expect(t.serve.aces).toBe(1)
    expect(t.reception.efficiency).toBe(1)
    expect(t.totalPoints).toBe(2)
  })
})
