import {
  ROTATION_MAP,
  BACK_ROW_POSITIONS,
  FRONT_BACK_RULES,
  LEFT_RIGHT_RULES
} from '../lib/volleyball.constants'

export interface CourtPosition {
  playerId: string
  playerName: string
  isLibero: boolean
  rotationPosition: number
}

export interface RotationState {
  positions: Record<number, CourtPosition>
  currentRotation: number
  servingTeam: 'us' | 'opponent'
  liberoSwap?: {
    liberoId: string
    replacedPlayerId: string
  }
}

export interface OverlapViolation {
  positions: [number, number]
  message: string
}

export const initializeRotation = (
  slots: {
    playerId: string
    playerName: string
    isLibero: boolean
    rotationPosition: number
  }[],
  servingTeam: 'us' | 'opponent' = 'us'
): RotationState => {
  const positions: Record<number, CourtPosition> = {}

  for (const slot of slots) {
    positions[slot.rotationPosition] = {
      playerId: slot.playerId,
      playerName: slot.playerName,
      isLibero: slot.isLibero,
      rotationPosition: slot.rotationPosition
    }
  }

  return { positions, currentRotation: 1, servingTeam }
}

export const rotate = (state: RotationState): RotationState => {
  const newPositions: Record<number, CourtPosition> = {}

  for (const [newPos, oldPos] of Object.entries(ROTATION_MAP)) {
    const pos = parseInt(newPos)
    newPositions[pos] = {
      ...state.positions[oldPos],
      rotationPosition: pos
    }
  }

  return {
    ...state,
    positions: newPositions,
    currentRotation: (state.currentRotation % 6) + 1
  }
}

export const validateOverlap = (
  positions: Record<number, CourtPosition>
): OverlapViolation[] => {
  const violations: OverlapViolation[] = []

  for (const rule of FRONT_BACK_RULES) {
    if (!positions[rule.front] || !positions[rule.back]) continue
    violations.push({
      positions: [rule.front, rule.back],
      message: `Position ${rule.front} must be in front of position ${rule.back}`
    })
  }

  return violations
}

export const applyLiberoSwap = (
  state: RotationState,
  liberoId: string,
  replacedPlayerId: string
): RotationState => {
  const positions = { ...state.positions }

  let liberoPosition: number | null = null
  let replacedPosition: number | null = null

  for (const [pos, player] of Object.entries(positions)) {
    if (player.playerId === liberoId) liberoPosition = parseInt(pos)
    if (player.playerId === replacedPlayerId) replacedPosition = parseInt(pos)
  }

  if (liberoPosition === null || replacedPosition === null) {
    throw new Error('PLAYER_NOT_FOUND')
  }

  if (!BACK_ROW_POSITIONS.includes(replacedPosition)) {
    throw new Error('LIBERO_FRONT_ROW')
  }

  const temp = positions[liberoPosition]
  positions[liberoPosition] = positions[replacedPosition]
  positions[replacedPosition] = temp

  return {
    ...state,
    positions,
    liberoSwap: { liberoId, replacedPlayerId }
  }
}

export const serializePositions = (
  positions: Record<number, CourtPosition>
): object => {
  return Object.entries(positions).reduce((acc, [pos, player]) => {
    return { ...acc, [pos]: player }
  }, {})
}