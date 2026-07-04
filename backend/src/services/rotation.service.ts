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

const ROTATION_MAP: Record<number, number> = {
  1: 6,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5
}

const FRONT_BACK_RULES: { front: number; back: number }[] = [
  { front: 2, back: 1 },
  { front: 3, back: 6 },
  { front: 4, back: 5 }
]

const LEFT_RIGHT_RULES: { left: number; right: number }[] = [
  { left: 4, right: 3 },
  { left: 3, right: 2 },
  { left: 5, right: 6 },
  { left: 6, right: 1 }
]

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
    const frontPos = rule.front
    const backPos = rule.back
    if (!positions[frontPos] || !positions[backPos]) continue

    violations.push({
      positions: [frontPos, backPos],
      message: `Position ${frontPos} must be in front of position ${backPos} — check player overlap`
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

  const backRowPositions = [1, 5, 6]
  if (!backRowPositions.includes(replacedPosition)) {
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