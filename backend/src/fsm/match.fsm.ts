import {
  MAX_SUBS_PER_SET,
  REGULAR_SET_TARGET,
  DECIDING_SET_TARGET,
  MIN_WIN_DIFF
} from '../lib/volleyball.constants'

export type MatchStatus = 'pending' | 'live' | 'completed'
export type SetStatus = 'active' | 'finished'
export type MatchEvent =
  | 'START_MATCH'
  | 'END_MATCH'

export type SetEvent =
  | 'END_SET'

export type GuardContext = {
  ourScore?: number
  opponentScore?: number
  setNumber?: number
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

export type Team = 'us' | 'opponent'

export interface RallyOutcome {
  nextServingTeam: Team
  isSideOut: boolean
  // Only the team that gains the serve rotates
  rotatingTeam: Team | null
}

/**
 *the winner scores and serves
 * next. If the receiving team won, that is a side-out and the receiving team,
 * and only that team, rotates one position.
 */
export const rallyOutcome = (scorer: Team, servingTeam: Team): RallyOutcome => {
  const isSideOut = scorer !== servingTeam
  return {
    nextServingTeam: scorer,
    isSideOut,
    rotatingTeam: isSideOut ? scorer : null
  }
}

/**
 * Who served a rally, worked out from what a point event records: the next
 * server, and whether the serve changed hands.
 */
export const serverOfRally = (rally: { servingTeam: Team; isSideOut: boolean }): Team =>
  rally.isSideOut ? (rally.servingTeam === 'us' ? 'opponent' : 'us') : rally.servingTeam

/**
 * First service of a set: sets 1 and 5 go to the toss winner,
 * sets 2-4 to the team that did not serve first in the previous set.
 */
export const firstServerForSet = (
  setNumber: number,
  ctx: { toss?: Team; previousSetFirstServer?: Team }
): Team => {
  if (setNumber < 1 || setNumber > 5) {
    throw new GuardError(`There is no set ${setNumber} in a best-of-five match`)
  }

  if (setNumber === 1 || setNumber === 5) {
    if (!ctx.toss) throw new GuardError(`Set ${setNumber} needs the toss result to decide the first server`)
    return ctx.toss
  }

  if (!ctx.previousSetFirstServer) {
    throw new GuardError(`Set ${setNumber} needs to know who served first in set ${setNumber - 1}`)
  }
  return ctx.previousSetFirstServer === 'us' ? 'opponent' : 'us'
}
// FIVB 19.3.1: the libero may not serve, block or attempt to block.
const LIBERO_FORBIDDEN_ACTIONS = ['serve', 'block']

export const assertLiberoMayPerform = (eventType: string): void => {
  if (LIBERO_FORBIDDEN_ACTIONS.includes(eventType)) {
    throw new GuardError(`A libero may not ${eventType}`)
  }
}

export interface SubRequest {
  playerOutId: string
  playerInId: string
}

export interface SubstitutionContext {
  subCount: number
  history: SubRequest[]
  starterIds: string[]
  benchIds: string[]
  liberoIds: string[]
  onCourtIds: string[]
  liberoReplacingId: string | null
  rally: number
  lastRequestRally: number | null
}

export const assertCanSubstitute = (ctx: SubstitutionContext, requests: SubRequest[]): void => {
  if (requests.length === 0) throw new Error('SUB_EMPTY')
  if (ctx.subCount + requests.length > MAX_SUBS_PER_SET) throw new Error('SUB_LIMIT')
  if (ctx.lastRequestRally !== null && ctx.rally <= ctx.lastRequestRally) throw new Error('SUB_NEEDS_RALLY')

  const onCourt = new Set(ctx.onCourtIds)
  const history = [...ctx.history]

  for (const { playerOutId, playerInId } of requests) {
    if (ctx.liberoIds.includes(playerOutId) || ctx.liberoIds.includes(playerInId)) {
      throw new Error('LIBERO_NOT_SUBSTITUTABLE')
    }
    if (!onCourt.has(playerOutId)) throw new Error('PLAYER_NOT_ON_COURT')
    if (playerOutId === ctx.liberoReplacingId) throw new Error('LIBERO_REPLACING_PLAYER')
    if (onCourt.has(playerInId)) throw new Error('PLAYER_ALREADY_ON_COURT')

    const enteredFor = history.find(h => h.playerInId === playerOutId && ctx.starterIds.includes(h.playerOutId))

    if (enteredFor) {
      if (playerInId !== enteredFor.playerOutId) throw new Error('SUB_WRONG_PAIR')
    } else if (ctx.starterIds.includes(playerOutId)) {
      if (history.some(h => h.playerOutId === playerOutId)) throw new Error('SUB_PLAYER_ALREADY_LEFT')
      if (ctx.starterIds.includes(playerInId)) throw new Error('SUB_WRONG_PAIR')
      if (history.some(h => h.playerInId === playerInId)) throw new Error('SUB_PLAYER_ALREADY_PLAYED')
      if (!ctx.benchIds.includes(playerInId)) throw new Error('PLAYER_NOT_ON_BENCH')
    } else {
      throw new Error('PLAYER_NOT_ON_COURT')
    }

    onCourt.delete(playerOutId)
    onCourt.add(playerInId)
    history.push({ playerOutId, playerInId })
  }
}

export const assertCanCallTimeout = (remaining: number): void => {
  if (remaining <= 0) throw new Error('NO_TIMEOUTS_LEFT')
}

export const assertCanChallenge = (ctx: {
  remaining: number
  pending: boolean
  rally: number
  challengedRallies: number[]
}): void => {
  if (ctx.pending) throw new Error('CHALLENGE_PENDING')
  if (ctx.remaining <= 0) throw new Error('NO_CHALLENGES_LEFT')
  if (ctx.rally === 0) throw new Error('NOTHING_TO_CHALLENGE')
  if (ctx.challengedRallies.includes(ctx.rally)) throw new Error('RALLY_ALREADY_CHALLENGED')
}

export const resolveChallengeOutcome = (ctx: {
  successful: boolean
  awardPoint: boolean
  challenger: Team
  lastRallyWinner: Team
}): { consumesChallenge: boolean; overturn: boolean } => {
  if (!ctx.successful) return { consumesChallenge: true, overturn: false }
  if (!ctx.awardPoint) return { consumesChallenge: false, overturn: false }
  if (ctx.lastRallyWinner === ctx.challenger) throw new Error('NOTHING_TO_OVERTURN')
  return { consumesChallenge: false, overturn: true }
}
