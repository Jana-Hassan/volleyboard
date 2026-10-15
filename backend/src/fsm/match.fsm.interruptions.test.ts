import { describe, it, expect } from 'vitest'
import {
  assertCanSubstitute,
  assertCanCallTimeout,
  assertCanChallenge,
  resolveChallengeOutcome,
  SubstitutionContext
} from './match.fsm'

const ctx = (over: Partial<SubstitutionContext> = {}): SubstitutionContext => ({
  subCount: 0,
  history: [],
  starterIds: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  benchIds: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7'],
  liberoIds: ['L1'],
  onCourtIds: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
  liberoReplacingId: null,
  rally: 10,
  lastRequestRally: null,
  ...over
})

const sub = (playerOutId: string, playerInId: string) => ({ playerOutId, playerInId })

describe('substitution limits (FIVB 15.6.1)', () => {
  it('allows up to six substitutions per set', () => {
    expect(() => assertCanSubstitute(ctx({ subCount: 5 }), [sub('S1', 'B1')])).not.toThrow()
  })

  it('refuses a seventh substitution', () => {
    expect(() => assertCanSubstitute(ctx({ subCount: 6 }), [sub('S1', 'B1')])).toThrow('SUB_LIMIT')
  })

  it('counts every player in a multi-player request', () => {
    expect(() => assertCanSubstitute(ctx({ subCount: 5 }), [sub('S1', 'B1'), sub('S2', 'B2')])).toThrow('SUB_LIMIT')
    expect(() => assertCanSubstitute(ctx({ subCount: 4 }), [sub('S1', 'B1'), sub('S2', 'B2')])).not.toThrow()
  })

  it('a returning starter counts as a substitution too', () => {
    const c = ctx({ subCount: 6, history: [sub('S1', 'B1')], onCourtIds: ['B1', 'S2', 'S3', 'S4', 'S5', 'S6'] })
    expect(() => assertCanSubstitute(c, [sub('B1', 'S1')])).toThrow('SUB_LIMIT')
  })
})

describe('who may come on and go off (FIVB 15.6.2, 15.6.3)', () => {
  it('a starter may leave for a bench player', () => {
    expect(() => assertCanSubstitute(ctx(), [sub('S1', 'B1')])).not.toThrow()
  })

  it('a starter may come back once, and only for the player who replaced them', () => {
    const c = ctx({ subCount: 1, history: [sub('S1', 'B1')], onCourtIds: ['B1', 'S2', 'S3', 'S4', 'S5', 'S6'] })
    expect(() => assertCanSubstitute(c, [sub('B1', 'S1')])).not.toThrow()
  })

  it('a starter who has left and come back may not leave again', () => {
    const c = ctx({ subCount: 2, history: [sub('S1', 'B1'), sub('B1', 'S1')] })
    expect(() => assertCanSubstitute(c, [sub('S1', 'B2')])).toThrow('SUB_PLAYER_ALREADY_LEFT')
  })

  it('a starter may not come back for someone other than their own substitute', () => {
    const c = ctx({ subCount: 2, history: [sub('S1', 'B1'), sub('S2', 'B2')], onCourtIds: ['B1', 'B2', 'S3', 'S4', 'S5', 'S6'] })
    expect(() => assertCanSubstitute(c, [sub('B2', 'S1')])).toThrow('SUB_WRONG_PAIR')
    expect(() => assertCanSubstitute(c, [sub('S3', 'S1')])).toThrow('SUB_WRONG_PAIR')
  })

  it('a substitute may only be replaced by the starter they replaced', () => {
    const c = ctx({ subCount: 1, history: [sub('S1', 'B1')], onCourtIds: ['B1', 'S2', 'S3', 'S4', 'S5', 'S6'] })
    expect(() => assertCanSubstitute(c, [sub('B1', 'B2')])).toThrow('SUB_WRONG_PAIR')
  })

  it('a substitute may enter only once per set', () => {
    const c = ctx({ subCount: 2, history: [sub('S1', 'B1'), sub('B1', 'S1')] })
    expect(() => assertCanSubstitute(c, [sub('S2', 'B1')])).toThrow('SUB_PLAYER_ALREADY_PLAYED')
  })

  it('the player coming on must be on the bench for this match', () => {
    expect(() => assertCanSubstitute(ctx(), [sub('S1', 'R1')])).toThrow('PLAYER_NOT_ON_BENCH')
  })

  it('the player coming on cannot already be on court', () => {
    expect(() => assertCanSubstitute(ctx(), [sub('S1', 'S2')])).toThrow('PLAYER_ALREADY_ON_COURT')
  })

  it('the player going off must be on court', () => {
    expect(() => assertCanSubstitute(ctx(), [sub('B3', 'B1')])).toThrow('PLAYER_NOT_ON_COURT')
  })

  it('the libero is never part of a regular substitution', () => {
    expect(() => assertCanSubstitute(ctx(), [sub('L1', 'B1')])).toThrow('LIBERO_NOT_SUBSTITUTABLE')
    expect(() => assertCanSubstitute(ctx(), [sub('S1', 'L1')])).toThrow('LIBERO_NOT_SUBSTITUTABLE')
  })

  it('a player who is off court for the libero cannot be substituted until the libero leaves', () => {
    expect(() => assertCanSubstitute(ctx({ liberoReplacingId: 'S5' }), [sub('S5', 'B1')])).toThrow('LIBERO_REPLACING_PLAYER')
    expect(() => assertCanSubstitute(ctx({ liberoReplacingId: 'S5' }), [sub('S1', 'B1')])).not.toThrow()
  })
})

describe('substitution requests (FIVB 15.10, 16.1)', () => {
  it('several players may be substituted in one request (double switch)', () => {
    expect(() => assertCanSubstitute(ctx(), [sub('S1', 'B1'), sub('S4', 'B2')])).not.toThrow()
  })

  it('a request is checked as a whole: the same player cannot go off twice', () => {
    expect(() => assertCanSubstitute(ctx(), [sub('S1', 'B1'), sub('S1', 'B2')])).toThrow('PLAYER_NOT_ON_COURT')
  })

  it('a request is checked as a whole: the same substitute cannot come on twice', () => {
    expect(() => assertCanSubstitute(ctx(), [sub('S1', 'B1'), sub('S2', 'B1')])).toThrow('PLAYER_ALREADY_ON_COURT')
  })

  it('two separate requests by the same team need a completed rally between them', () => {
    expect(() => assertCanSubstitute(ctx({ rally: 10, lastRequestRally: 10 }), [sub('S1', 'B1')])).toThrow('SUB_NEEDS_RALLY')
    expect(() => assertCanSubstitute(ctx({ rally: 11, lastRequestRally: 10 }), [sub('S1', 'B1')])).not.toThrow()
  })

  it('a request must contain at least one substitution', () => {
    expect(() => assertCanSubstitute(ctx(), [])).toThrow('SUB_EMPTY')
  })
})

describe('time-outs (FIVB 15.4)', () => {
  it('each team has two time-outs per set', () => {
    expect(() => assertCanCallTimeout(2)).not.toThrow()
    expect(() => assertCanCallTimeout(1)).not.toThrow()
  })

  it('a third time-out in the set is refused', () => {
    expect(() => assertCanCallTimeout(0)).toThrow('NO_TIMEOUTS_LEFT')
  })
})

describe('video challenges (FIVB Video Challenge regulations)', () => {
  const base = { remaining: 2, pending: false, rally: 5, challengedRallies: [] as number[] }

  it('a team with challenges left may challenge the last rally', () => {
    expect(() => assertCanChallenge(base)).not.toThrow()
  })

  it('no challenge without challenges left', () => {
    expect(() => assertCanChallenge({ ...base, remaining: 0 })).toThrow('NO_CHALLENGES_LEFT')
  })

  it('no new challenge while one is under review', () => {
    expect(() => assertCanChallenge({ ...base, pending: true })).toThrow('CHALLENGE_PENDING')
  })

  it('nothing to challenge before the first rally of the set', () => {
    expect(() => assertCanChallenge({ ...base, rally: 0 })).toThrow('NOTHING_TO_CHALLENGE')
  })

  it('a team may not challenge the same rally twice', () => {
    expect(() => assertCanChallenge({ ...base, challengedRallies: [5] })).toThrow('RALLY_ALREADY_CHALLENGED')
    expect(() => assertCanChallenge({ ...base, challengedRallies: [4] })).not.toThrow()
  })

  it('an unsuccessful challenge uses one up and changes nothing else', () => {
    expect(resolveChallengeOutcome({ successful: false, awardPoint: false, challenger: 'us', lastRallyWinner: 'opponent' }))
      .toEqual({ consumesChallenge: true, overturn: false })
  })

  it('a successful challenge is kept', () => {
    expect(resolveChallengeOutcome({ successful: true, awardPoint: false, challenger: 'us', lastRallyWinner: 'opponent' }))
      .toEqual({ consumesChallenge: false, overturn: false })
  })

  it('a successful challenge that reverses the call gives the rally to the challenger', () => {
    expect(resolveChallengeOutcome({ successful: true, awardPoint: true, challenger: 'us', lastRallyWinner: 'opponent' }))
      .toEqual({ consumesChallenge: false, overturn: true })
    expect(resolveChallengeOutcome({ successful: true, awardPoint: true, challenger: 'opponent', lastRallyWinner: 'us' }))
      .toEqual({ consumesChallenge: false, overturn: true })
  })

  it('cannot award a rally the challenger already won', () => {
    expect(() => resolveChallengeOutcome({ successful: true, awardPoint: true, challenger: 'us', lastRallyWinner: 'us' }))
      .toThrow('NOTHING_TO_OVERTURN')
  })

  it('an unsuccessful challenge never awards a point', () => {
    expect(resolveChallengeOutcome({ successful: false, awardPoint: true, challenger: 'us', lastRallyWinner: 'opponent' }))
      .toEqual({ consumesChallenge: true, overturn: false })
  })
})
