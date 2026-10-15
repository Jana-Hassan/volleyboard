import { describe, it, expect } from 'vitest'
import { initializeRotation, rotate, liberoIn, liberoOut, courtView, substitute, RotationState } from './rotation.service'

//when the receiving team gains the right to serve, its players
// rotate one position clockwise: 2 -> 1 (to serve), 1 -> 6, 6 -> 5, 5 -> 4,
// 4 -> 3, 3 -> 2.

const lineup = () => initializeRotation(
  ['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) => ({
    playerId: name,
    playerName: name,
    isLibero: false,
    rotationPosition: i + 1   // A starts at 1, B at 2, ... F at 6
  })),
  'us'
)

const whoIsAt = (state: RotationState) =>
  [1, 2, 3, 4, 5, 6].map(pos => state.positions[pos].playerId).join('')

describe('rotate (FIVB 7.6.1)', () => {
  it('moves every player one position clockwise', () => {
    const next = rotate(lineup(), 1)
    // the player who was in 2 now serves from 1, the server goes to 6, and so on
    expect(next.positions[1].playerId).toBe('B')
    expect(next.positions[6].playerId).toBe('A')
    expect(next.positions[5].playerId).toBe('F')
    expect(next.positions[4].playerId).toBe('E')
    expect(next.positions[3].playerId).toBe('D')
    expect(next.positions[2].playerId).toBe('C')
  })

  it('keeps each player\'s rotationPosition in step with the slot they occupy', () => {
    const next = rotate(lineup(), 1)
    for (const pos of [1, 2, 3, 4, 5, 6]) {
      expect(next.positions[pos].rotationPosition).toBe(pos)
    }
  })

  it('advances the rotation number and wraps from 6 back to 1', () => {
    let state = lineup()
    const seen: number[] = []
    for (let i = 0; i < 7; i++) {
      state = rotate(state, i + 1)
      seen.push(state.currentRotation)
    }
    expect(seen).toEqual([2, 3, 4, 5, 6, 1, 2])
  })

  it('returns to the starting order after six rotations', () => {
    let state = lineup()
    for (let i = 0; i < 6; i++) state = rotate(state, i + 1)
    expect(whoIsAt(state)).toBe('ABCDEF')
    expect(state.currentRotation).toBe(1)
  })

  it('never changes who is on court, only where', () => {
    const next = rotate(lineup(), 1)
    expect(whoIsAt(next).split('').sort().join('')).toBe('ABCDEF')
  })

  it('does not mutate the state it was given', () => {
    const start = lineup()
    const snapshot = JSON.stringify(start)
    rotate(start, 1)
    expect(JSON.stringify(start)).toBe(snapshot)
  })
})


// liberos stand in for a back-row player and must never serve, block or play front row.
const L1 = { playerId: 'L1', playerName: 'Libero One' }
const L2 = { playerId: 'L2', playerName: 'Libero Two' }

// A..F in positions 1..6. `serving` decides whether position 1 is serving.
const court = (serving: 'us' | 'opponent' = 'opponent') => ({ ...lineup(), servingTeam: serving } as RotationState)
const viewAt = (state: RotationState, pos: number) => courtView(state)[pos].playerId

describe('libero replacement (FIVB 19.3.2)', () => {
  it('replaces a back-row player at 5 or 6 without touching the rotation order', () => {
    for (const [pos, player] of [[5, 'E'], [6, 'F']] as const) {
      const state = liberoIn(court(), L1, player, 0)
      expect(viewAt(state, pos)).toBe('L1')
      expect(courtView(state)[pos]).toMatchObject({ isLibero: true, rotationPosition: pos, playerName: 'Libero One' })
      expect(whoIsAt(state)).toBe('ABCDEF')           // rotation order unchanged
      expect(state.libero?.onCourt).toEqual({ liberoId: 'L1', liberoName: 'Libero One', replacedPlayerId: player })
    }
  })

  it('may replace the player in position 1 while the opponent is serving', () => {
    const state = liberoIn(court('opponent'), L1, 'A', 0)
    expect(viewAt(state, 1)).toBe('L1')
  })

  it('may not replace the player in position 1 while we are serving: the libero cannot serve', () => {
    expect(() => liberoIn(court('us'), L1, 'A', 0)).toThrow('LIBERO_CANNOT_SERVE')
  })

  it('may not replace a front-row player (positions 2, 3, 4)', () => {
    for (const player of ['B', 'C', 'D']) {
      expect(() => liberoIn(court(), L1, player, 0)).toThrow('LIBERO_FRONT_ROW')
    }
  })

  it('may only replace a player who is on court', () => {
    expect(() => liberoIn(court(), L1, 'Z', 0)).toThrow('PLAYER_NOT_ON_COURT')
  })

  it('only one libero on court at a time', () => {
    const state = liberoIn(court(), L1, 'E', 0)
    expect(() => liberoIn(state, L2, 'F', 1)).toThrow('LIBERO_ALREADY_ON_COURT')
  })

  it('the second libero may replace the first directly (libero exchange)', () => {
    const state = liberoIn(liberoIn(court(), L1, 'E', 0), L2, 'L1', 1)
    expect(viewAt(state, 5)).toBe('L2')
    expect(state.libero?.onCourt).toEqual({ liberoId: 'L2', liberoName: 'Libero Two', replacedPlayerId: 'E' })
  })

  it('a libero cannot replace themselves', () => {
    const state = liberoIn(court(), L1, 'E', 0)
    expect(() => liberoIn(state, L1, 'L1', 1)).toThrow('LIBERO_ALREADY_ON_COURT')
  })

  it('the libero leaves only for the player they replaced, back into the same slot', () => {
    const state = liberoOut(liberoIn(court(), L1, 'E', 0), 1)
    expect(viewAt(state, 5)).toBe('E')
    expect(state.libero?.onCourt).toBeNull()
  })

  it('cannot take a libero off when none is on court', () => {
    expect(() => liberoOut(court(), 0)).toThrow('NO_LIBERO_ON_COURT')
  })

  it('needs a completed rally between two libero replacements', () => {
    const inAt3 = liberoIn(court(), L1, 'E', 3)
    expect(() => liberoOut(inAt3, 3)).toThrow('LIBERO_NEEDS_RALLY')
    expect(() => liberoIn(inAt3, L2, 'L1', 3)).toThrow('LIBERO_NEEDS_RALLY')
    expect(viewAt(liberoOut(inAt3, 4), 5)).toBe('E')
  })

  it('the first replacement of a set needs no previous rally', () => {
    expect(() => liberoIn(court(), L1, 'E', 0)).not.toThrow()
  })

  it('does not mutate the state it was given', () => {
    const start = court()
    const snapshot = JSON.stringify(start)
    liberoOut(liberoIn(start, L1, 'E', 0), 1)
    expect(JSON.stringify(start)).toBe(snapshot)
  })
})

describe('libero and rotation (FIVB 19.3.2, 7.6.1)', () => {
  it('stays on when their slot rotates 6 -> 5', () => {
    const state = rotate(liberoIn(court(), L1, 'F', 0), 1)
    expect(viewAt(state, 5)).toBe('L1')
  })

  it('stays on when their slot rotates 1 -> 6', () => {
    const state = rotate(liberoIn(court('opponent'), L1, 'A', 0), 1)
    expect(viewAt(state, 6)).toBe('L1')
  })

  it('is forced off when their slot rotates 5 -> 4 (front row); the replaced player comes back', () => {
    const state = rotate(liberoIn(court(), L1, 'E', 0), 7)
    expect(viewAt(state, 4)).toBe('E')
    expect(state.libero?.onCourt).toBeNull()
    expect(Object.values(courtView(state)).some(p => p.isLibero)).toBe(false)
  })

  it('the forced exit counts as a replacement: the libero cannot come straight back', () => {
    const forcedOff = rotate(liberoIn(court(), L1, 'E', 0), 7)
    expect(() => liberoIn(forcedOff, L1, 'F', 7)).toThrow('LIBERO_NEEDS_RALLY')
    expect(() => liberoIn(forcedOff, L1, 'F', 8)).not.toThrow()
  })

  it('across a whole set the libero is never on court as the server or in the front row', () => {
    // Libero re-enters for whoever is at 5 or 6 whenever allowed, through 12 side-outs.
    let state = court('opponent')
    let rally = 0
    for (let i = 0; i < 12; i++) {
      if (!state.libero?.onCourt) {
        const target = courtView(state)[6].playerId
        state = liberoIn(state, L1, target, rally)
      }
      rally++
      state = { ...rotate(state, rally), servingTeam: 'us' }   // we side out and serve
      const view = courtView(state)
      for (const pos of [1, 2, 3, 4]) expect(view[pos].isLibero).toBe(false)
      rally++
      state = { ...state, servingTeam: 'opponent' }            // they break back, nobody rotates
    }
  })
})

describe('courtView', () => {
  it('is the rotation order when no libero is on', () => {
    const state = court()
    expect(courtView(state)).toEqual(state.positions)
  })
})

describe('substitute (FIVB 15.5)', () => {
  it('the incoming player takes the outgoing player slot in the rotation order', () => {
    const next = substitute(lineup(), 'C', { playerId: 'X', playerName: 'Xavier' })
    expect(whoIsAt(next)).toBe('ABXDEF')
    expect(next.positions[3]).toEqual({ playerId: 'X', playerName: 'Xavier', isLibero: false, rotationPosition: 3 })
  })

  it('does not rotate, change the server or touch the libero', () => {
    const start = liberoIn(court(), L1, 'E', 0)
    const next = substitute(start, 'C', { playerId: 'X', playerName: 'Xavier' })
    expect(next.currentRotation).toBe(start.currentRotation)
    expect(next.servingTeam).toBe(start.servingTeam)
    expect(next.libero).toEqual(start.libero)
  })

  it('refuses a player who is not in the rotation order', () => {
    expect(() => substitute(lineup(), 'Z', { playerId: 'X', playerName: 'Xavier' })).toThrow('PLAYER_NOT_ON_COURT')
  })

  it('does not mutate the state it was given', () => {
    const start = lineup()
    const snapshot = JSON.stringify(start)
    substitute(start, 'C', { playerId: 'X', playerName: 'Xavier' })
    expect(JSON.stringify(start)).toBe(snapshot)
  })
})
