import {
  MAX_SUBS_PER_SET,
  MAX_CHALLENGES_PER_SET,
  MAX_TIMEOUTS_PER_SET,
  REGULAR_SET_TARGET,
  DECIDING_SET_TARGET,
  MIN_WIN_DIFF
} from '../lib/volleyball.constants'

export type MatchStatus = 'pending' | 'live' | 'completed'
export type SetStatus = 'active' | 'finished'
export type RallyStatus =
  | 'serving'
  | 'in_rally'
  | 'point_scored'
  | 'rotating'
  | 'timeout'
  | 'substitution'
  | 'challenge'

export type MatchEvent =
  | 'START_MATCH'
  | 'END_MATCH'

export type SetEvent =
  | 'END_SET'

export type RallyEvent =
  | 'SERVE'
  | 'POINT_US'
  | 'POINT_OPPONENT'
  | 'SIDE_OUT'
  | 'NO_SIDE_OUT'
  | 'ROTATION_DONE'
  | 'CALL_TIMEOUT'
  | 'TIMEOUT_END'
  | 'REQUEST_SUB'
  | 'SUB_CONFIRMED'
  | 'CALL_CHALLENGE'
  | 'CHALLENGE_RESULT'

export type GuardContext = {
  subCount?: number
  ourTimeoutsRemaining?: number
  ourChallengesRemaining?: number
  ourScore?: number
  opponentScore?: number
  setNumber?: number
  ourSetsWon?: number
  opponentSetsWon?: number
  hasOverlapViolation?: boolean
}

const matchTransitions: Record<MatchStatus, Partial<Record<MatchEvent, MatchStatus>>> = {
  pending:   { START_MATCH: 'live' },
  live:      { END_MATCH: 'completed' },
  completed: {}
}

const setTransitions: Record<SetStatus, Partial<Record<SetEvent, SetStatus>>> = {
  active:   { END_SET: 'finished' },
  finished: {}
}

const rallyTransitions: Record<RallyStatus, Partial<Record<RallyEvent, RallyStatus>>> = {
  serving: {
    SERVE:        'in_rally',
    CALL_TIMEOUT: 'timeout',
    REQUEST_SUB:  'substitution'
  },
  in_rally: {
    POINT_US:       'point_scored',
    POINT_OPPONENT: 'point_scored',
    CALL_CHALLENGE: 'challenge'
  },
  point_scored: {
    SIDE_OUT:    'rotating',
    NO_SIDE_OUT: 'serving'
  },
  rotating: {
    ROTATION_DONE: 'serving'
  },
  timeout: {
    TIMEOUT_END: 'serving'
  },
  substitution: {
    SUB_CONFIRMED: 'serving'
  },
  challenge: {
    CHALLENGE_RESULT: 'serving'
  }
}

export class InvalidTransitionError extends Error {
  constructor(current: string, event: string) {
    super(`Invalid transition: cannot apply '${event}' in state '${current}'`)
    this.name = 'InvalidTransitionError'
  }
}

export class GuardError extends Error {
  constructor(reason: string) {
    super(`Transition blocked: ${reason}`)
    this.name = 'GuardError'
  }
}

export const matchTransition = (
  current: MatchStatus,
  event: MatchEvent
): MatchStatus => {
  const next = matchTransitions[current][event]
  if (!next) throw new InvalidTransitionError(current, event)
  return next
}

export const setTransition = (
  current: SetStatus,
  event: SetEvent,
  ctx: GuardContext = {}
): SetStatus => {
  const next = setTransitions[current][event]
  if (!next) throw new InvalidTransitionError(current, event)

  if (event === 'END_SET') {
    const { ourScore = 0, opponentScore = 0, setNumber = 1 } = ctx
    const targetScore = setNumber === 5 ? DECIDING_SET_TARGET : REGULAR_SET_TARGET
    const diff = Math.abs(ourScore - opponentScore)
    const maxScore = Math.max(ourScore, opponentScore)

    if (maxScore < targetScore || diff < MIN_WIN_DIFF) {
      throw new GuardError(
        `Set cannot end: need ${targetScore} points with ${MIN_WIN_DIFF}+ point lead (current: ${ourScore}-${opponentScore})`
      )
    }
  }

  return next
}

export const rallyTransition = (
  current: RallyStatus,
  event: RallyEvent,
  ctx: GuardContext = {}
): RallyStatus => {
  const next = rallyTransitions[current][event]
  if (!next) throw new InvalidTransitionError(current, event)

  if (event === 'REQUEST_SUB') {
    if ((ctx.subCount ?? 0) >= MAX_SUBS_PER_SET) {
      throw new GuardError(`Substitution limit reached (max ${MAX_SUBS_PER_SET} per set)`)
    }
  }

  if (event === 'CALL_TIMEOUT') {
    if ((ctx.ourTimeoutsRemaining ?? 0) <= 0) {
      throw new GuardError('No timeouts remaining')
    }
  }

  if (event === 'CALL_CHALLENGE') {
    if ((ctx.ourChallengesRemaining ?? 0) <= 0) {
      throw new GuardError('No challenges remaining')
    }
  }

  if (event === 'SERVE') {
    if (ctx.hasOverlapViolation) {
      throw new GuardError('Overlap violation detected — fix positions before serving')
    }
  }

  return next
}

export const checkMatchEnd = (ourSetsWon: number, opponentSetsWon: number): boolean => {
  return ourSetsWon === 3 || opponentSetsWon === 3
}

export const checkSetEnd = (
  ourScore: number,
  opponentScore: number,
  setNumber: number
): boolean => {
  const targetScore = setNumber === 5 ? DECIDING_SET_TARGET : REGULAR_SET_TARGET
  const maxScore = Math.max(ourScore, opponentScore)
  const diff = Math.abs(ourScore - opponentScore)
  return maxScore >= targetScore && diff >= MIN_WIN_DIFF
}

export const determineSideOut = (
  scorer: 'us' | 'opponent',
  servingTeam: 'us' | 'opponent'
): boolean => {
  return scorer !== servingTeam
}