import {
  ROTATION_MAP,
  BACK_ROW_POSITIONS,
  FRONT_ROW_POSITIONS,
  SERVER_POSITION
} from '../lib/volleyball.constants'

export interface CourtPosition {
  playerId: string
  playerName: string
  isLibero: boolean
  rotationPosition: number
}

export interface LiberoOnCourt {
  liberoId: string
  liberoName: string
  replacedPlayerId: string
}

export interface LiberoState {
  onCourt: LiberoOnCourt | null
  // Rally count (points played in the set) at the last libero replacement.
  // FIVB 19.3.2.1 needs a completed rally between two replacements.
  lastChangeRally: number | null
}

export interface RotationState {
  // The official rotation order: always the six regular players, never the
  // libero. What is actually on court is courtView(state).
  positions: Record<number, CourtPosition>
  currentRotation: number
  servingTeam: 'us' | 'opponent'
  libero?: LiberoState | null
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

  return { positions, currentRotation: 1, servingTeam, libero: { onCourt: null, lastChangeRally: null } }
}

const positionOf = (state: RotationState, playerId: string): number | null => {
  for (const [pos, player] of Object.entries(state.positions)) {
    if (player.playerId === playerId) return parseInt(pos)
  }
  return null
}

const assertRallySinceLastChange = (state: RotationState, rally: number): void => {
  const last = state.libero?.lastChangeRally
  if (last !== null && last !== undefined && rally <= last) throw new Error('LIBERO_NEEDS_RALLY')
}


export const rotate = (state: RotationState, rally: number): RotationState => {
  const newPositions: Record<number, CourtPosition> = {}

  // ROTATION_MAP is "from -> to": the player in 2 moves to 1, 1 moves to 6...
  for (const [fromPos, toPos] of Object.entries(ROTATION_MAP)) {
    newPositions[toPos] = {
      ...state.positions[parseInt(fromPos)],
      rotationPosition: toPos
    }
  }

  let libero = state.libero ?? null
  if (libero?.onCourt) {
    const next = { ...state, positions: newPositions }
    const slot = positionOf(next, libero.onCourt.replacedPlayerId)
    if (slot !== null && FRONT_ROW_POSITIONS.includes(slot)) {
      libero = { onCourt: null, lastChangeRally: rally }
    }
  }

  return {
    ...state,
    positions: newPositions,
    currentRotation: (state.currentRotation % 6) + 1,
    libero
  }
}

export const liberoIn = (
  state: RotationState,
  libero: { playerId: string; playerName: string },
  replacedPlayerId: string,
  rally: number
): RotationState => {
  const onCourt = state.libero?.onCourt ?? null

  if (onCourt) {
    const isExchange = replacedPlayerId === onCourt.liberoId && libero.playerId !== onCourt.liberoId
    if (!isExchange) throw new Error('LIBERO_ALREADY_ON_COURT')
    assertRallySinceLastChange(state, rally)
    return {
      ...state,
      libero: {
        onCourt: { liberoId: libero.playerId, liberoName: libero.playerName, replacedPlayerId: onCourt.replacedPlayerId },
        lastChangeRally: rally
      }
    }
  }

  const slot = positionOf(state, replacedPlayerId)
  if (slot === null) throw new Error('PLAYER_NOT_ON_COURT')
  if (!BACK_ROW_POSITIONS.includes(slot)) throw new Error('LIBERO_FRONT_ROW')
  if (slot === SERVER_POSITION && state.servingTeam === 'us') throw new Error('LIBERO_CANNOT_SERVE')
  assertRallySinceLastChange(state, rally)

  return {
    ...state,
    libero: {
      onCourt: { liberoId: libero.playerId, liberoName: libero.playerName, replacedPlayerId },
      lastChangeRally: rally
    }
  }
}

export const liberoOut = (state: RotationState, rally: number): RotationState => {
  if (!state.libero?.onCourt) throw new Error('NO_LIBERO_ON_COURT')
  assertRallySinceLastChange(state, rally)
  return { ...state, libero: { onCourt: null, lastChangeRally: rally } }
}

export const courtView = (state: RotationState): Record<number, CourtPosition> => {
  const onCourt = state.libero?.onCourt
  if (!onCourt) return state.positions

  const view: Record<number, CourtPosition> = { ...state.positions }
  for (const [pos, player] of Object.entries(state.positions)) {
    if (player.playerId === onCourt.replacedPlayerId) {
      const p = parseInt(pos)
      view[p] = { playerId: onCourt.liberoId, playerName: onCourt.liberoName, isLibero: true, rotationPosition: p }
    }
  }
  return view
}

export const serializePositions = (
  positions: Record<number, CourtPosition>
): object => {
  return Object.entries(positions).reduce((acc, [pos, player]) => {
    return { ...acc, [pos]: player }
  }, {})
}

export const serializeLibero = (libero: LiberoState | null | undefined): LiberoState =>
  libero ?? { onCourt: null, lastChangeRally: null }

/** Rebuild the rotation state from a stored Rotation row and its set. */
export const rotationStateFromRow = (
  row: { positions: unknown; libero?: unknown },
  set: { currentRotation: number; servingTeam: string }
): RotationState => ({
  positions: row.positions as Record<number, CourtPosition>,
  currentRotation: set.currentRotation,
  servingTeam: set.servingTeam as 'us' | 'opponent',
  libero: (row.libero as LiberoState | null | undefined) ?? null
})

export const substitute = (
  state: RotationState,
  playerOutId: string,
  playerIn: { playerId: string; playerName: string }
): RotationState => {
  const slot = positionOf(state, playerOutId)
  if (slot === null) throw new Error('PLAYER_NOT_ON_COURT')
  return {
    ...state,
    positions: {
      ...state.positions,
      [slot]: { playerId: playerIn.playerId, playerName: playerIn.playerName, isLibero: false, rotationPosition: slot }
    }
  }
}
