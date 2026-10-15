import type { MatchSet, MatchEvent, Player, OpponentPlayer } from '@prisma/client'
import type { RotationState, CourtPosition, LiberoOnCourt } from '../services/rotation.service'

export const MATCH_STARTED = 'match_started' as const
export const SCORE_UPDATED = 'score_updated' as const
export const SET_FINISHED = 'set_finished' as const
export const MATCH_FINISHED = 'match_finished' as const
export const NEXT_SET_STARTED = 'next_set_started' as const
export const MATCH_ENDED = 'match_ended' as const
export const LIBERO_CHANGED = 'libero_changed' as const
export const SUBSTITUTION_MADE = 'substitution_made' as const
export const TIMEOUT_CALLED = 'timeout_called' as const
export const CHALLENGE_CALLED = 'challenge_called' as const
export const CHALLENGE_RESOLVED = 'challenge_resolved' as const
export const EVENT_UNDONE = 'event_undone' as const
export const EVENT_LOGGED = 'event_logged' as const
export const OPPONENT_ROSTER_CHANGED = 'opponent_roster_changed' as const

export interface MatchStartedPayload {
  matchId: string
  set: MatchSet
  rotationState: RotationState
}

export interface SetScoped {
  setId?: string
  version?: number
}

export interface PointEventSummary {
  id: string
  team: string
  eventType: string
  outcome: string
  rotation: number | null
  occurredAt: Date
  payload: unknown
}

export interface ScoreUpdatedPayload extends SetScoped {
  setNumber: number
  scorer: 'us' | 'opponent'
  clientEventId: string | null
  event: PointEventSummary
  currentPositions: Record<number, CourtPosition>
  rotationOrder: Record<number, CourtPosition>
  libero: LiberoOnCourt | null
  ourScore: number
  opponentScore: number
  currentRotation: number
  rotationState: RotationState
  isSideOut: boolean
  servingTeam: 'us' | 'opponent'
  setOver: boolean
  matchOver: boolean
  ourSetsWon: number
  opponentSetsWon: number
}

export interface SetFinishedPayload extends SetScoped {
  setNumber: number
  ourScore: number
  opponentScore: number
  ourSetsWon: number
  opponentSetsWon: number
}

export interface MatchFinishedPayload extends SetScoped {
  ourSetsWon: number
  opponentSetsWon: number
  winner: 'us' | 'opponent'
}

export interface NextSetStartedPayload {
  setNumber: number
  servingTeam: 'us' | 'opponent'
  rotationState: RotationState
}

export interface MatchEndedPayload {
  matchId: string
  status: 'completed'
}

export interface LiberoChangedPayload extends SetScoped {
  setId: string
  // On court with the libero applied, and the official rotation order.
  currentPositions: Record<number, CourtPosition>
  rotationOrder: Record<number, CourtPosition>
  libero: LiberoOnCourt | null
}

export interface CourtSnapshot {
  currentPositions: Record<number, CourtPosition>
  rotationOrder: Record<number, CourtPosition>
  libero: LiberoOnCourt | null
}

export interface SubstitutionMadePayload extends CourtSnapshot, SetScoped {
  setId: string
  substitutions: { playerOutId: string; playerInId: string }[]
  subCount: number
  atScoreUs: number
  atScoreThem: number
}

export interface TimeoutCalledPayload extends SetScoped {
  setId: string
  calledBy: 'us' | 'opponent'
  ourTimeoutsRemaining: number
  oppTimeoutsRemaining: number
  atScoreUs: number
  atScoreThem: number
}

export interface ChallengeCalledPayload extends SetScoped {
  setId: string
  challengeId: string
  challenger: 'us' | 'opponent'
  callType: string
  atScoreUs: number
  atScoreThem: number
}

export interface ChallengeResolvedPayload extends SetScoped {
  setId: string
  challengeId: string
  challenger: 'us' | 'opponent'
  successful: boolean
  overturned: boolean
  ourChallengesRemaining: number
  oppChallengesRemaining: number
}

export interface EventUndonePayload extends CourtSnapshot, SetScoped {
  setId: string
  removedEventIds: string[]
  liveStats?: unknown
  ourScore: number
  opponentScore: number
  servingTeam: 'us' | 'opponent'
  currentRotation: number
}

export interface EventLoggedPayload extends SetScoped {
  setId: string
  event: MatchEvent & { player: Player | null; opponentPlayer: OpponentPlayer | null }
  clientEventId: string | null
  scored: 'us' | 'opponent' | null
  liveStats?: unknown
}

export interface OpponentRosterChangedPayload {
  matchId: string
}

export interface DomainEventPayloads {
  [MATCH_STARTED]: MatchStartedPayload
  [SCORE_UPDATED]: ScoreUpdatedPayload
  [SET_FINISHED]: SetFinishedPayload
  [MATCH_FINISHED]: MatchFinishedPayload
  [NEXT_SET_STARTED]: NextSetStartedPayload
  [MATCH_ENDED]: MatchEndedPayload
  [LIBERO_CHANGED]: LiberoChangedPayload
  [SUBSTITUTION_MADE]: SubstitutionMadePayload
  [TIMEOUT_CALLED]: TimeoutCalledPayload
  [CHALLENGE_CALLED]: ChallengeCalledPayload
  [CHALLENGE_RESOLVED]: ChallengeResolvedPayload
  [EVENT_UNDONE]: EventUndonePayload
  [EVENT_LOGGED]: EventLoggedPayload
  [OPPONENT_ROSTER_CHANGED]: OpponentRosterChangedPayload
}

export type DomainEventName = keyof DomainEventPayloads

export interface DomainEvent<N extends DomainEventName = DomainEventName> {
  name: N
  matchId: string
  payload: DomainEventPayloads[N]
}

export type AnyDomainEvent = {
  [N in DomainEventName]: { name: N; matchId: string; payload: DomainEventPayloads[N] }
}[DomainEventName]
