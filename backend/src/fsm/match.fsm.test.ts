import { describe, it, expect } from 'vitest'
import {
  setTransition,
  matchTransition,
  checkSetEnd,
  checkMatchEnd,
  rallyOutcome,
  firstServerForSet,
  serverOfRally,
  assertLiberoMayPerform,
  InvalidTransitionError,
  GuardError
} from './match.fsm'

// Every expectation here comes from the FIVB Official Volleyball Rules

describe('winning a set (FIVB 6.2)', () => {
  // [ourScore, opponentScore, setNumber, setIsOver]
  const cases: [number, number, number, boolean][] = [
    [0, 0, 1, false],
    [24, 22, 1, false],   // two-point lead but below 25
    [25, 23, 1, true],
    [25, 24, 1, false],   // 25 reached without a two-point lead
    [24, 25, 1, false],
    [26, 24, 1, true],    // deuce, no cap
    [24, 26, 1, true],    // opponent wins
    [39, 38, 2, false],
    [40, 38, 3, true],    // long deuce
    [25, 0, 4, true],
    [15, 13, 4, false],   // 15 is only the target in the deciding set
    [14, 12, 5, false],
    [15, 13, 5, true],    // deciding set to 15
    [15, 14, 5, false],
    [16, 14, 5, true],
    [13, 15, 5, true],
    [25, 23, 5, true]     // well past 15 with a lead is over
  ]

  for (const [us, them, setNumber, over] of cases) {
    it(`set ${setNumber} at ${us}-${them} is ${over ? '' : 'not '}over`, () => {
      expect(checkSetEnd(us, them, setNumber)).toBe(over)
    })

    it(`END_SET guard agrees at ${us}-${them} in set ${setNumber}`, () => {
      const end = () => setTransition('active', 'END_SET', { ourScore: us, opponentScore: them, setNumber })
      if (over) expect(end()).toBe('finished')
      else expect(end).toThrow(GuardError)
    })
  }

  it('a finished set cannot be finished again', () => {
    expect(() => setTransition('finished', 'END_SET', { ourScore: 25, opponentScore: 23, setNumber: 1 }))
      .toThrow(InvalidTransitionError)
  })
})

describe('winning the match (FIVB 6.3: best of five, first to three sets)', () => {
  const cases: [number, number, boolean][] = [
    [3, 0, true], [3, 1, true], [3, 2, true],
    [0, 3, true], [1, 3, true], [2, 3, true],
    [0, 0, false], [2, 0, false], [2, 1, false], [2, 2, false], [1, 2, false]
  ]
  for (const [us, them, over] of cases) {
    it(`${us}-${them} in sets is ${over ? '' : 'not '}over`, () => {
      expect(checkMatchEnd(us, them)).toBe(over)
    })
  }
})

describe('match lifecycle', () => {
  it('goes pending -> live -> completed and no further', () => {
    expect(matchTransition('pending', 'START_MATCH')).toBe('live')
    expect(matchTransition('live', 'END_MATCH')).toBe('completed')
    expect(() => matchTransition('completed', 'END_MATCH')).toThrow(InvalidTransitionError)
    expect(() => matchTransition('completed', 'START_MATCH')).toThrow(InvalidTransitionError)
    expect(() => matchTransition('live', 'START_MATCH')).toThrow(InvalidTransitionError)
    expect(() => matchTransition('pending', 'END_MATCH')).toThrow(InvalidTransitionError)
  })
})

describe('consequences of winning a rally (FIVB 6.1.3, 7.6.1)', () => {
  it('serving team wins: scores, keeps serving, nobody rotates', () => {
    expect(rallyOutcome('us', 'us')).toEqual({ nextServingTeam: 'us', isSideOut: false, rotatingTeam: null })
    expect(rallyOutcome('opponent', 'opponent')).toEqual({ nextServingTeam: 'opponent', isSideOut: false, rotatingTeam: null })
  })

  it('receiving team wins: scores, gains the serve, and only that team rotates', () => {
    expect(rallyOutcome('us', 'opponent')).toEqual({ nextServingTeam: 'us', isSideOut: true, rotatingTeam: 'us' })
    expect(rallyOutcome('opponent', 'us')).toEqual({ nextServingTeam: 'opponent', isSideOut: true, rotatingTeam: 'opponent' })
  })

  it('a team never rotates when it loses the serve', () => {
    expect(rallyOutcome('opponent', 'us').rotatingTeam).not.toBe('us')
    expect(rallyOutcome('us', 'opponent').rotatingTeam).not.toBe('opponent')
  })
})

describe('first service of each set (FIVB 12.1)', () => {
  it('sets 1 and 5 go to the team that won the toss', () => {
    expect(firstServerForSet(1, { toss: 'us' })).toBe('us')
    expect(firstServerForSet(1, { toss: 'opponent' })).toBe('opponent')
    expect(firstServerForSet(5, { toss: 'opponent', previousSetFirstServer: 'opponent' })).toBe('opponent')
    expect(firstServerForSet(5, { toss: 'us', previousSetFirstServer: 'us' })).toBe('us')
  })

  it('sets 1 and 5 need a toss result', () => {
    expect(() => firstServerForSet(1, {})).toThrow(GuardError)
    expect(() => firstServerForSet(5, { previousSetFirstServer: 'us' })).toThrow(GuardError)
  })

  it('sets 2 to 4 start with the team that did not serve first in the previous set', () => {
    expect(firstServerForSet(2, { previousSetFirstServer: 'us' })).toBe('opponent')
    expect(firstServerForSet(3, { previousSetFirstServer: 'opponent' })).toBe('us')
    expect(firstServerForSet(4, { previousSetFirstServer: 'us' })).toBe('opponent')
  })

  it('sets 2 to 4 ignore any toss and do not depend on who won the previous set', () => {
    expect(firstServerForSet(2, { previousSetFirstServer: 'us', toss: 'us' })).toBe('opponent')
    expect(firstServerForSet(3, { previousSetFirstServer: 'us', toss: 'us' })).toBe('opponent')
  })

  it('sets 2 to 4 need to know who served first in the previous set', () => {
    expect(() => firstServerForSet(2, {})).toThrow(GuardError)
  })

  it('alternates across a full five-set match after a toss won by us', () => {
    const s1 = firstServerForSet(1, { toss: 'us' })
    const s2 = firstServerForSet(2, { previousSetFirstServer: s1 })
    const s3 = firstServerForSet(3, { previousSetFirstServer: s2 })
    const s4 = firstServerForSet(4, { previousSetFirstServer: s3 })
    const s5 = firstServerForSet(5, { previousSetFirstServer: s4, toss: 'opponent' })
    expect([s1, s2, s3, s4, s5]).toEqual(['us', 'opponent', 'us', 'opponent', 'opponent'])
  })

  it('rejects set numbers outside 1-5', () => {
    expect(() => firstServerForSet(0, { toss: 'us' })).toThrow(GuardError)
    expect(() => firstServerForSet(6, { previousSetFirstServer: 'us' })).toThrow(GuardError)
  })
})

describe('serverOfRally: who served, from what a point event records', () => {
  it('no side-out: the server kept the serve', () => {
    expect(serverOfRally({ servingTeam: 'us', isSideOut: false })).toBe('us')
    expect(serverOfRally({ servingTeam: 'opponent', isSideOut: false })).toBe('opponent')
  })

  it('side-out: the other team was serving', () => {
    expect(serverOfRally({ servingTeam: 'us', isSideOut: true })).toBe('opponent')
    expect(serverOfRally({ servingTeam: 'opponent', isSideOut: true })).toBe('us')
  })

  it('agrees with rallyOutcome for every rally', () => {
    for (const server of ['us', 'opponent'] as const) {
      for (const scorer of ['us', 'opponent'] as const) {
        const { nextServingTeam, isSideOut } = rallyOutcome(scorer, server)
        expect(serverOfRally({ servingTeam: nextServingTeam, isSideOut })).toBe(server)
      }
    }
  })
})

describe('what a libero may do (FIVB 19.3.1)', () => {
  it('may not serve or block', () => {
    expect(() => assertLiberoMayPerform('serve')).toThrow(GuardError)
    expect(() => assertLiberoMayPerform('block')).toThrow(GuardError)
  })

  it('may receive, dig, set and attack', () => {
    for (const action of ['reception', 'dig', 'set', 'attack']) {
      expect(() => assertLiberoMayPerform(action)).not.toThrow()
    }
  })
})
