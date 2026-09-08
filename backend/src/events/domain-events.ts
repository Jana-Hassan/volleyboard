import type { MatchSet } from '@prisma/client'
import type { RotationState } from '../services/rotation.service'

export const MATCH_STARTED = 'match_started' as const
export const SCORE_UPDATED = 'score_updated' as const
export const SET_FINISHED = 'set_finished' as const
export const MATCH_FINISHED = 'match_finished' as const
export const NEXT_SET_STARTED = 'next_set_started' as const
export const MATCH_ENDED = 'match_ended' as const

export interface MatchStartedPayload {
  matchId: string
  set: MatchSet
  rotationState: RotationState
}

export interface ScoreUpdatedPayload {
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

export interface SetFinishedPayload {
  setNumber: number
  ourScore: number
  opponentScore: number
  ourSetsWon: number
  opponentSetsWon: number
}

export interface MatchFinishedPayload {
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

export interface DomainEventPayloads {
  [MATCH_STARTED]: MatchStartedPayload
  [SCORE_UPDATED]: ScoreUpdatedPayload
  [SET_FINISHED]: SetFinishedPayload
  [MATCH_FINISHED]: MatchFinishedPayload
  [NEXT_SET_STARTED]: NextSetStartedPayload
  [MATCH_ENDED]: MatchEndedPayload
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
