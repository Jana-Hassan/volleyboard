import { describe, it, expect } from 'vitest'
import { scoringCue } from './cue'
import type { LiveEvent } from './types'

const ev = (over: Partial<LiveEvent>): LiveEvent => ({
  id: 'e1', team: 'us', eventType: 'serve', outcome: 'ace', playerId: 'P14', rotation: 1, occurredAt: 'x', ...over
})
const point = (team: 'us' | 'opponent', sourceEventId?: string, id = 'pt1'): LiveEvent =>
  ev({ id, team, eventType: 'point', outcome: 'scored', playerId: null, payload: sourceEventId ? { sourceEventId } : {} })

describe('scoring cue on the court', () => {
  it('nothing has happened yet: no cue', () => {
    expect(scoringCue([])).toBeNull()
  })

  it('our ace: green cue on the server as soon as it is tapped', () => {
    expect(scoringCue([ev({ id: 'c1', clientEventId: 'c1', pending: true })])).toEqual({ playerId: 'P14', tone: 'us', key: 'c1' })
  })

  it('our kill: green cue on the attacker', () => {
    expect(scoringCue([ev({ eventType: 'attack', outcome: 'kill', playerId: 'P8' })])?.tone).toBe('us')
  })

  it('our attack error: burgundy cue on the player who erred', () => {
    expect(scoringCue([ev({ eventType: 'attack', outcome: 'error', playerId: 'P8' })])).toMatchObject({ playerId: 'P8', tone: 'opp' })
  })

  it('a rally that did not score gives no cue', () => {
    expect(scoringCue([ev({ eventType: 'reception', outcome: 'perfect' })])).toBeNull()
    expect(scoringCue([ev({ eventType: 'attack', outcome: 'in_play' })])).toBeNull()
  })

  it('once the server confirms, the point points back to the same player and keeps the same key, so the cue does not replay', () => {
    const tapped = scoringCue([ev({ id: 'c1', clientEventId: 'c1', pending: true })])
    const confirmed = scoringCue([ev({ id: 'srv-1', clientEventId: 'c1' }), point('us', 'srv-1')])
    expect(confirmed).toEqual(tapped)
  })

  it('a point coded on another device cues the same way', () => {
    expect(scoringCue([ev({ id: 'srv-2', clientEventId: null, playerId: 'P2' }), point('us', 'srv-2')])).toEqual({ playerId: 'P2', tone: 'us', key: 'srv-2' })
  })

  it('a manual +1 has no player, so no cue', () => {
    expect(scoringCue([point('us')])).toBeNull()
  })

  it('an opponent event has no player of ours, so no cue', () => {
    expect(scoringCue([ev({ team: 'opponent', playerId: null, eventType: 'attack', outcome: 'kill' })])).toBeNull()
  })

  it('only the latest event counts', () => {
    expect(scoringCue([ev({}), ev({ id: 'e2', eventType: 'dig', outcome: 'good' })])).toBeNull()
  })
})
