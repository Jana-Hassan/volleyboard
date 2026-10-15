import { describe, it, expect } from 'vitest'
import { liveReducer, viewOf, initialLiveState } from './matchReducer'
import type { LiveSnapshot, LiveState, Court } from './types'

const pos = (n: number, id: string) => ({ playerId: id, playerName: id, isLibero: false, rotationPosition: n })
const court = (ids: string[]): Court => {
  const positions = Object.fromEntries(ids.map((id, i) => [String(i + 1), pos(i + 1, id)]))
  return { currentPositions: positions, rotationOrder: positions, libero: null }
}

const snapshot = (over: Partial<LiveSnapshot> = {}, version = 10): LiveSnapshot => ({
  match: { id: 'm1', teamId: 't1', teamName: 'Japan', status: 'live', opponentName: 'Argentina', competition: 'VNL', scheduledAt: null },
  role: 'analyst',
  permissions: ['team.view', 'match.code'],
  ourSetsWon: 0,
  opponentSetsWon: 0,
  matchOver: false,
  sets: [{ id: 's1', setNumber: 1, ourScore: 5, opponentScore: 3, status: 'active' }],
  activeSet: {
    id: 's1', setNumber: 1, ourScore: 5, opponentScore: 3, status: 'active', servingTeam: 'us', currentRotation: 1,
    subCount: 0, ourTimeoutsRemaining: 2, oppTimeoutsRemaining: 2, ourChallengesRemaining: 2, oppChallengesRemaining: 2, version
  },
  court: court(['A', 'B', 'C', 'D', 'E', 'F']),
  lineup: { id: 'l1', name: 'L', rotationSystem: '5-1', slots: [] },
  players: [],
  opponentPlayers: [],
  events: [],
  substitutions: [],
  timeouts: [],
  challenges: [],
  liveStats: { players: [], opponent: [] },
  ...over
})

const loaded = (snap = snapshot()): LiveState => liveReducer(initialLiveState, { type: 'snapshot', snapshot: snap })
const msg = (state: LiveState, name: string, payload: Record<string, unknown>) =>
  liveReducer(state, { type: 'message', name, payload: { setId: 's1', ...payload } })

const scoreUpdated = (version: number, over: Record<string, unknown> = {}) => ({
  version, ourScore: 6, opponentScore: 3, servingTeam: 'us', currentRotation: 1, scorer: 'us', setNumber: 1,
  clientEventId: null,
  event: { id: `p${version}`, team: 'us', eventType: 'point', outcome: 'scored', rotation: 1, occurredAt: '2026-10-15T10:00:00Z' },
  ...court(['A', 'B', 'C', 'D', 'E', 'F']),
  ...over
})

describe('loading', () => {
  it('starts empty and takes the snapshot as the truth', () => {
    expect(viewOf(initialLiveState)).toBeNull()
    const s = loaded()
    expect(viewOf(s)?.activeSet?.ourScore).toBe(5)
    expect(s.needsResync).toBe(false)
  })

  it('ignores socket messages that arrive before any snapshot', () => {
    const s = msg(initialLiveState, 'score_updated', scoreUpdated(11))
    expect(s.base).toBeNull()
  })

  it('ignores a snapshot that is older than what it already has for the same set', () => {
    const s = msg(loaded(), 'score_updated', scoreUpdated(11))
    const stale = liveReducer(s, { type: 'snapshot', snapshot: snapshot({}, 10) })
    expect(viewOf(stale)?.activeSet?.ourScore).toBe(6)
  })

  it('takes a newer snapshot or one for another set', () => {
    const next = snapshot({ activeSet: { ...snapshot().activeSet!, id: 's2', setNumber: 2, ourScore: 0, opponentScore: 0, version: 0 } }, 0)
    expect(viewOf(liveReducer(loaded(), { type: 'snapshot', snapshot: next }))?.activeSet?.id).toBe('s2')
  })
})

describe('versioned messages', () => {
  it('applies the next version', () => {
    const s = msg(loaded(), 'score_updated', scoreUpdated(11))
    expect(viewOf(s)?.activeSet).toMatchObject({ ourScore: 6, version: 11 })
  })

  it('ignores a duplicate or older version, so nothing is counted twice', () => {
    const once = msg(loaded(), 'score_updated', scoreUpdated(11))
    const twice = msg(once, 'score_updated', scoreUpdated(11, { ourScore: 99 }))
    const older = msg(once, 'score_updated', scoreUpdated(9, { ourScore: 99 }))
    expect(viewOf(twice)?.activeSet?.ourScore).toBe(6)
    expect(viewOf(older)?.activeSet?.ourScore).toBe(6)
  })

  it('a gap in versions asks for a fresh snapshot instead of guessing', () => {
    const s = msg(loaded(), 'score_updated', scoreUpdated(13))
    expect(s.needsResync).toBe(true)
    expect(viewOf(s)?.activeSet?.ourScore).toBe(5)
  })

  it('a message for another set asks for a fresh snapshot', () => {
    const s = liveReducer(loaded(), { type: 'message', name: 'score_updated', payload: { ...scoreUpdated(11), setId: 'other' } })
    expect(s.needsResync).toBe(true)
  })

  it('match-level changes ask for a fresh snapshot', () => {
    for (const name of ['match_started', 'next_set_started', 'match_ended', 'opponent_roster_changed']) {
      expect(liveReducer(loaded(), { type: 'message', name, payload: {} }).needsResync).toBe(true)
    }
  })

  it('a fresh snapshot clears the resync request', () => {
    const s = liveReducer(msg(loaded(), 'score_updated', scoreUpdated(13)), { type: 'snapshot', snapshot: snapshot({}, 13) })
    expect(s.needsResync).toBe(false)
  })
})

describe('applying what happened', () => {
  it('a point moves the score, server, rotation and court, and joins the feed', () => {
    const rotated = court(['B', 'C', 'D', 'E', 'F', 'A'])
    const s = msg(loaded(), 'score_updated', scoreUpdated(11, { servingTeam: 'us', currentRotation: 2, ...rotated }))
    const v = viewOf(s)!
    expect(v.activeSet).toMatchObject({ ourScore: 6, servingTeam: 'us', currentRotation: 2 })
    expect(v.court?.currentPositions['1'].playerId).toBe('B')
    expect(v.events.map(e => e.id)).toEqual(['p11'])
    expect(v.sets[0]).toMatchObject({ ourScore: 6, opponentScore: 3 })
  })

  it('a coded event joins the feed and refreshes the stats', () => {
    const stats = { players: [{ playerId: 'A' }], opponent: [] }
    const s = msg(loaded(), 'event_logged', { version: 11, event: { id: 'e1', team: 'us', eventType: 'reception', outcome: 'perfect', rotation: 1, occurredAt: 'x' }, liveStats: stats, clientEventId: null })
    expect(viewOf(s)?.events.map(e => e.id)).toEqual(['e1'])
    expect(viewOf(s)?.liveStats).toEqual(stats)
  })

  it('an undo removes the events and puts the score, server and court back', () => {
    let s = msg(loaded(), 'score_updated', scoreUpdated(11))
    s = msg(s, 'event_undone', { version: 12, removedEventIds: ['p11'], ourScore: 5, opponentScore: 3, servingTeam: 'opponent', currentRotation: 1, ...court(['A', 'B', 'C', 'D', 'E', 'F']) })
    const v = viewOf(s)!
    expect(v.events).toEqual([])
    expect(v.activeSet).toMatchObject({ ourScore: 5, servingTeam: 'opponent', version: 12 })
    expect(v.sets[0].ourScore).toBe(5)
  })

  it('a time-out updates both teams\' remaining time-outs', () => {
    const s = msg(loaded(), 'timeout_called', { version: 11, calledBy: 'opponent', ourTimeoutsRemaining: 2, oppTimeoutsRemaining: 1, atScoreUs: 5, atScoreThem: 3 })
    expect(viewOf(s)?.activeSet?.oppTimeoutsRemaining).toBe(1)
    expect(viewOf(s)?.timeouts).toHaveLength(1)
  })

  it('a substitution updates the court and the count', () => {
    const s = msg(loaded(), 'substitution_made', { version: 11, substitutions: [{ playerOutId: 'A', playerInId: 'X' }], subCount: 1, atScoreUs: 5, atScoreThem: 3, ...court(['X', 'B', 'C', 'D', 'E', 'F']) })
    expect(viewOf(s)?.court?.currentPositions['1'].playerId).toBe('X')
    expect(viewOf(s)?.activeSet?.subCount).toBe(1)
    expect(viewOf(s)?.substitutions).toEqual([{ playerOutId: 'A', playerInId: 'X', atScoreUs: 5, atScoreThem: 3 }])
  })

  it('a libero change updates the court', () => {
    const c = court(['A', 'B', 'C', 'D', 'L', 'F'])
    const s = msg(loaded(), 'libero_changed', { version: 11, ...c, libero: { liberoId: 'L', liberoName: 'L', replacedPlayerId: 'E' } })
    expect(viewOf(s)?.court?.libero?.liberoId).toBe('L')
  })

  it('a challenge is shown under review, then resolved', () => {
    let s = msg(loaded(), 'challenge_called', { version: 11, challengeId: 'c1', challenger: 'us', callType: 'in_out', atScoreUs: 5, atScoreThem: 3 })
    expect(viewOf(s)?.challenges[0]).toMatchObject({ id: 'c1', successful: null })
    s = msg(s, 'challenge_resolved', { version: 12, challengeId: 'c1', successful: false, overturned: false, ourChallengesRemaining: 1, oppChallengesRemaining: 2 })
    expect(viewOf(s)?.challenges[0].successful).toBe(false)
    expect(viewOf(s)?.activeSet?.ourChallengesRemaining).toBe(1)
  })

  it('the end of a set and of the match are recorded', () => {
    let s = msg(loaded(), 'set_finished', { version: 11, setNumber: 1, ourScore: 25, opponentScore: 20, ourSetsWon: 3, opponentSetsWon: 1 })
    expect(viewOf(s)?.activeSet?.status).toBe('finished')
    expect(viewOf(s)?.sets[0]).toMatchObject({ status: 'finished', ourScore: 25 })
    s = msg(s, 'match_finished', { version: 12, ourSetsWon: 3, opponentSetsWon: 1, winner: 'us' })
    expect(viewOf(s)).toMatchObject({ ourSetsWon: 3, matchOver: true, match: { status: 'completed' } })
  })
})

describe('instant taps (optimistic updates)', () => {
  const tapPoint = (s: LiveState, clientEventId: string, scorer: 'us' | 'opponent' = 'us') =>
    liveReducer(s, { type: 'optimistic', action: { kind: 'point', clientEventId, scorer } })

  it('a tapped point shows at once, before the server answers', () => {
    const v = viewOf(tapPoint(loaded(), 'c1', 'opponent'))!
    expect(v.activeSet).toMatchObject({ ourScore: 5, opponentScore: 4, servingTeam: 'opponent' })
  })

  it('the server echo replaces the guess without counting the point twice', () => {
    const s = msg(tapPoint(loaded(), 'c1'), 'score_updated', scoreUpdated(11, { clientEventId: 'c1' }))
    expect(s.pending).toEqual([])
    expect(viewOf(s)?.activeSet?.ourScore).toBe(6)
  })

  it('other people\'s points apply underneath a pending tap', () => {
    const s = msg(tapPoint(loaded(), 'c1'), 'score_updated', scoreUpdated(11, { ourScore: 5, opponentScore: 4, scorer: 'opponent', servingTeam: 'opponent' }))
    expect(viewOf(s)?.activeSet).toMatchObject({ ourScore: 6, opponentScore: 4, servingTeam: 'us' })
  })

  it('a refused tap rolls back', () => {
    const s = liveReducer(tapPoint(loaded(), 'c1'), { type: 'rollback', clientEventId: 'c1' })
    expect(viewOf(s)?.activeSet?.ourScore).toBe(5)
    expect(s.pending).toEqual([])
  })

  it('a tapped event appears in the feed at once and scores if it wins the rally', () => {
    const s = liveReducer(loaded(), { type: 'optimistic', action: { kind: 'event', clientEventId: 'c2', team: 'us', eventType: 'serve', outcome: 'ace', playerId: 'A', scorer: 'us' } })
    const v = viewOf(s)!
    expect(v.activeSet?.ourScore).toBe(6)
    expect(v.events[v.events.length - 1]).toMatchObject({ id: 'c2', pending: true, eventType: 'serve', outcome: 'ace' })
  })

  it('a non-scoring event does not change the score', () => {
    const s = liveReducer(loaded(), { type: 'optimistic', action: { kind: 'event', clientEventId: 'c3', team: 'us', eventType: 'reception', outcome: 'good', playerId: 'A', scorer: null } })
    expect(viewOf(s)?.activeSet?.ourScore).toBe(5)
  })

  it('the coded-event echo clears its pending tap', () => {
    const tapped = liveReducer(loaded(), { type: 'optimistic', action: { kind: 'event', clientEventId: 'c3', team: 'us', eventType: 'reception', outcome: 'good', playerId: 'A', scorer: null } })
    const s = msg(tapped, 'event_logged', { version: 11, clientEventId: 'c3', event: { id: 'e9', team: 'us', eventType: 'reception', outcome: 'good', rotation: 1, occurredAt: 'x', clientEventId: 'c3' } })
    expect(s.pending).toEqual([])
    expect(viewOf(s)?.events.map(e => e.id)).toEqual(['e9'])
  })

  it('a snapshot that already contains a tap clears it', () => {
    const tapped = tapPoint(loaded(), 'c1')
    const fresh = snapshot({ events: [{ id: 'p11', team: 'us', eventType: 'point', outcome: 'scored', rotation: 1, occurredAt: 'x', clientEventId: 'c1' }], activeSet: { ...snapshot().activeSet!, ourScore: 6, version: 11 } }, 11)
    const s = liveReducer(tapped, { type: 'snapshot', snapshot: fresh })
    expect(s.pending).toEqual([])
    expect(viewOf(s)?.activeSet?.ourScore).toBe(6)
  })

  it('never shows a tap on a set that has finished', () => {
    const finished = msg(loaded(), 'set_finished', { version: 11, setNumber: 1, ourScore: 25, opponentScore: 20, ourSetsWon: 1, opponentSetsWon: 0 })
    const s = tapPoint(finished, 'c1')
    expect(viewOf(s)?.activeSet?.ourScore).toBe(25)
  })
})
