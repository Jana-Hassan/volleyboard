import type { CourtPosition, PlayerStats } from '../../types'

export type Team = 'us' | 'opponent'

export interface LiberoOnCourt {
  liberoId: string
  liberoName: string
  replacedPlayerId: string
}

export interface Court {
  currentPositions: Record<string, CourtPosition>
  rotationOrder: Record<string, CourtPosition>
  libero: LiberoOnCourt | null
}

export interface LiveEvent {
  id: string
  team: Team | string
  eventType: string
  outcome: string
  playerId?: string | null
  opponentPlayerId?: string | null
  rotation: number | null
  occurredAt: string
  clientEventId?: string | null
  payload?: unknown
  player?: { id: string; name: string; number: string } | null
  pending?: boolean
}

export interface LiveSet {
  id: string
  setNumber: number
  ourScore: number
  opponentScore: number
  status: 'active' | 'finished'
}

export interface ActiveSet extends LiveSet {
  servingTeam: Team
  currentRotation: number
  subCount: number
  ourTimeoutsRemaining: number
  oppTimeoutsRemaining: number
  ourChallengesRemaining: number
  oppChallengesRemaining: number
  version: number
}

export interface LiveSubstitution {
  playerOutId: string
  playerInId: string
  atScoreUs: number
  atScoreThem: number
}

export interface LiveTimeout {
  calledBy: Team
  atScoreUs: number
  atScoreThem: number
}

export interface LiveChallenge {
  id: string
  challenger: Team
  callType: string
  successful: boolean | null
  atScoreUs: number
  atScoreThem: number
}

export interface OpponentLine extends Omit<PlayerStats, 'playerId' | 'playerName'> {
  opponentPlayerId: string
  jersey: number
  name: string | null
}

export interface LiveStats {
  players: PlayerStats[]
  opponent: OpponentLine[]
}

export interface OpponentPlayer {
  id: string
  jersey: number
  name: string | null
  position: string | null
}

export interface LivePlayer {
  id: string
  name: string
  number: string
  position: string
  isLibero: boolean
}

export interface LiveSnapshot {
  match: {
    id: string
    teamId: string
    teamName: string
    status: 'pending' | 'live' | 'completed'
    opponentName: string
    competition: string
    scheduledAt: string | null
  }
  role: string
  permissions: string[]
  ourSetsWon: number
  opponentSetsWon: number
  matchOver: boolean
  sets: LiveSet[]
  activeSet: ActiveSet | null
  court: Court | null
  lineup: {
    id: string
    name: string
    rotationSystem: string
    slots: { playerId: string; role: string; rotationPosition: number | null }[]
  }
  players: LivePlayer[]
  opponentPlayers: OpponentPlayer[]
  events: LiveEvent[]
  substitutions: LiveSubstitution[]
  timeouts: LiveTimeout[]
  challenges: LiveChallenge[]
  liveStats: LiveStats | null
}

export type PendingAction =
  | { kind: 'point'; clientEventId: string; scorer: Team }
  | {
      kind: 'event'
      clientEventId: string
      team: Team
      eventType: string
      outcome: string
      playerId: string | null
      opponentPlayerId?: string | null
      scorer: Team | null
    }

export interface LiveState {
  base: LiveSnapshot | null
  pending: PendingAction[]
  needsResync: boolean
}

export type LiveAction =
  | { type: 'snapshot'; snapshot: LiveSnapshot }
  | { type: 'message'; name: string; payload: Record<string, unknown> }
  | { type: 'optimistic'; action: PendingAction }
  | { type: 'rollback'; clientEventId: string }
