export interface User {
  userId: string
  email: string
  name: string
}

export interface Team {
  id: string
  name: string
  logoUrl?: string
  createdAt: string
  members: TeamMember[]
  _count?: {
    players: number
    matches: number
  }
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: 'manager' | 'coach' | 'assistant' | 'analyst' | 'trainer'
  joinedAt: string
  user: {
    id: string
    name: string
    email: string
  }
}

export interface Player {
  id: string
  teamId: string
  name: string
  number: string
  position: string
  isLibero: boolean
  isActive: boolean
}

export interface LineupSlot {
  id: string
  lineupId: string
  playerId: string
  role: 'starter' | 'bench' | 'reserved'
  rotationPosition: number | null
  player: Player
}

export interface Lineup {
  id: string
  teamId: string
  name: string
  rotationSystem: string
  createdAt: string
  slots: LineupSlot[]
}

export interface CourtPosition {
  playerId: string
  playerName: string
  isLibero: boolean
  rotationPosition: number
}

export interface MatchSet {
  id: string
  matchId: string
  setNumber: number
  ourScore: number
  opponentScore: number
  currentRotation: number
  servingTeam: 'us' | 'opponent'
  subCount: number
  ourChallengesRemaining: number
  oppChallengesRemaining: number
  ourTimeoutsRemaining: number
  oppTimeoutsRemaining: number
  status: 'active' | 'finished'
  rotations: Rotation[]
  substitutions: Substitution[]
  challenges: Challenge[]
  timeouts: Timeout[]
}

export interface Rotation {
  id: string
  setId: string
  rotationNumber: number
  positions: Record<string, CourtPosition>
  recordedAt: string
}

export interface Substitution {
  id: string
  setId: string
  playerOutId: string
  playerInId: string
  atScoreUs: number
  atScoreThem: number
  subbedAt: string
}

export interface Challenge {
  id: string
  setId: string
  challenger: 'us' | 'opponent'
  callType: string
  successful: boolean | null
  challengedAt: string
}

export interface Timeout {
  id: string
  setId: string
  calledBy: 'us' | 'opponent'
  calledAt: string
}

export interface Match {
  id: string
  teamId: string
  lineupId: string
  opponentName: string
  status: 'pending' | 'live' | 'completed'
  startedAt: string | null
  endedAt: string | null
  sets: MatchSet[]
  lineup: Lineup
  team: Team
}

export interface MatchState {
  matchId: string
  status: string
  opponentName: string
  ourSetsWon: number
  opponentSetsWon: number
  matchOver: boolean
  activeSet: MatchSet | null
  currentPositions: Record<string, CourtPosition> | null
  sets: MatchSet[]
}

export interface PlayerStats {
  playerId: string
  playerName: string
  attack: { total: number; kills: number; errors: number; efficiency: number }
  serve: { total: number; aces: number; errors: number; efficiency: number }
  reception: { total: number; perfect: number; good: number; errors: number; efficiency: number }
  block: { total: number; kills: number; errors: number; touches: number }
  dig: { total: number; perfect: number; good: number; errors: number }
  set: { total: number; perfect: number; good: number; errors: number }
  totalPoints: number
}

export interface LiveStats {
  players: PlayerStats[]
  opponent: any[]
}

export type EventType = 'attack' | 'serve' | 'reception' | 'block' | 'dig' | 'set'
export type EventOutcome =
  | 'kill' | 'error' | 'in_play' | 'blocked'
  | 'ace' | 'perfect' | 'good' | 'touch'

export type MemberRole = 'manager' | 'coach' | 'assistant' | 'analyst' | 'trainer'