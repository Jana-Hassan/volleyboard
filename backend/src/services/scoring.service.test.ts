import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Prisma } from '@prisma/client'


vi.mock('./row-lock', () => ({ lockSet: vi.fn(async () => {}), lockMatch: vi.fn(async () => {}) }))
vi.mock('./team-access', () => ({ requirePermission: vi.fn(async () => 'coach') }))

import { completeSetWithin, scorePointWithin } from './scoring.service'
import { initializeRotation, serializePositions } from './rotation.service'

type Team = 'us' | 'opponent'


const makeMatch = (opts: { servingTeam: Team; setNumber?: number; ourScore?: number; opponentScore?: number; previousSets?: [number, number][]; liberoFor?: string }) => {
  const start = initializeRotation(
    ['A', 'B', 'C', 'D', 'E', 'F'].map((name, i) => ({ playerId: name, playerName: name, isLibero: false, rotationPosition: i + 1 })),
    opts.servingTeam
  )

  const match = { id: 'm1', teamId: 't1', status: 'live' }
  const previous = (opts.previousSets ?? []).map(([us, them], i) => ({
    id: `prev${i + 1}`, matchId: 'm1', setNumber: i + 1, ourScore: us, opponentScore: them, status: 'finished'
  }))
  const set = {
    id: 's1',
    matchId: 'm1',
    setNumber: opts.setNumber ?? 1,
    ourScore: opts.ourScore ?? 0,
    opponentScore: opts.opponentScore ?? 0,
    currentRotation: 1,
    servingTeam: opts.servingTeam as string,
    status: 'active'
  }
  const libero = opts.liberoFor
    ? { onCourt: { liberoId: 'L1', liberoName: 'Libero', replacedPlayerId: opts.liberoFor }, lastChangeRally: 0 }
    : null
  const rotations: any[] = [{ setId: 's1', rotationNumber: 1, positions: serializePositions(start.positions), libero }]
  const events: any[] = []
  const challenges: any[] = []

  const tx = {
    matchSet: {
      findUnique: vi.fn(async () => ({
        ...set,
        match: { ...match },
        rotations: [rotations[rotations.length - 1]]
      })),
      update: vi.fn(async ({ where, data }: any) => {
        const target = where.id === set.id ? set : previous.find(p => p.id === where.id)!
        Object.assign(target, data)
        return target
      }),
      findMany: vi.fn(async () => [...previous, set])
    },
    rotation: { create: vi.fn(async ({ data }: any) => { const row = { id: `r${rotations.length + 1}`, ...data }; rotations.push(row); return row }) },
    challenge: { findFirst: vi.fn(async () => challenges.find(c => c.successful === null) ?? null) },
    matchEvent: { create: vi.fn(async ({ data }: any) => { const row = { id: `e${events.length + 1}`, ...data }; events.push(row); return row }) },
    match: { update: vi.fn(async ({ data }: any) => { Object.assign(match, data); return match }) }
  }

  const rally = async (scorer: Team) =>
    scorePointWithin(tx as unknown as Prisma.TransactionClient, 's1', 'u1', scorer)

  const onCourt = () => {
    const positions = rotations[rotations.length - 1].positions as Record<string, { playerId: string }>
    return [1, 2, 3, 4, 5, 6].map(p => positions[p].playerId).join('')
  }

  const rallyFrom = async (scorer: Team, sourceEventId: string) =>
    scorePointWithin(tx as unknown as Prisma.TransactionClient, 's1', 'u1', scorer, { sourceEventId })

  return { set, match, rotations, events, challenges, rally, rallyFrom, onCourt }
}

describe('scoring a rally (FIVB 6.1.3, 7.6.1)', () => {
  let m: ReturnType<typeof makeMatch>

  describe('when we are serving', () => {
    beforeEach(() => { m = makeMatch({ servingTeam: 'us' }) })

    it('we win: point to us, we keep serving, nobody rotates', async () => {
      const { result } = await m.rally('us')
      expect(result).toMatchObject({ ourScore: 1, opponentScore: 0, servingTeam: 'us', isSideOut: false, currentRotation: 1 })
      expect(m.onCourt()).toBe('ABCDEF')
      expect(m.rotations).toHaveLength(1)
    })

    it('they win: point to them, they gain the serve, and WE DO NOT ROTATE', async () => {
      const { result } = await m.rally('opponent')
      expect(result).toMatchObject({ ourScore: 0, opponentScore: 1, servingTeam: 'opponent', isSideOut: true, currentRotation: 1 })
      expect(result.rotationState.servingTeam).toBe('opponent')
      expect(m.onCourt()).toBe('ABCDEF')
      expect(m.rotations).toHaveLength(1)
      expect(m.set.currentRotation).toBe(1)
    })
  })

  describe('when they are serving', () => {
    beforeEach(() => { m = makeMatch({ servingTeam: 'opponent' }) })

    it('we win: side-out, we rotate once clockwise and the player from 2 serves', async () => {
      const { result } = await m.rally('us')
      expect(result).toMatchObject({ ourScore: 1, servingTeam: 'us', isSideOut: true, currentRotation: 2 })
      expect(m.onCourt()).toBe('BCDEFA')
      expect(result.rotationState.positions[1].playerId).toBe('B')
      expect(m.rotations).toHaveLength(2)
    })

    it('they win: point to them, they keep serving, nobody rotates', async () => {
      const { result } = await m.rally('opponent')
      expect(result).toMatchObject({ opponentScore: 1, servingTeam: 'opponent', isSideOut: false, currentRotation: 1 })
      expect(m.onCourt()).toBe('ABCDEF')
    })
  })

  it('a full exchange (we lose our serve, then win it back) is exactly one rotation', async () => {
    m = makeMatch({ servingTeam: 'us' })
    await m.rally('opponent')
    await m.rally('us')
    expect(m.set.currentRotation).toBe(2)
    expect(m.onCourt()).toBe('BCDEFA')
  })

  it('runs of points by the serving team never rotate anyone', async () => {
    m = makeMatch({ servingTeam: 'us' })
    for (let i = 0; i < 5; i++) await m.rally('us')
    expect(m.set.currentRotation).toBe(1)
    m = makeMatch({ servingTeam: 'opponent' })
    for (let i = 0; i < 5; i++) await m.rally('opponent')
    expect(m.set.currentRotation).toBe(1)
    expect(m.onCourt()).toBe('ABCDEF')
  })

  it('six won side-outs bring us back to rotation 1 in the starting order', async () => {
    m = makeMatch({ servingTeam: 'opponent' })
    const seen: number[] = []
    for (let i = 0; i < 6; i++) {
      await m.rally('us')        // side-out, we rotate
      await m.rally('opponent')  // they break back, we must not rotate
      seen.push(m.set.currentRotation)
    }
    expect(seen).toEqual([2, 3, 4, 5, 6, 1])
    expect(m.onCourt()).toBe('ABCDEF')
  })

  it('credits each point to the rotation the rally was played in', async () => {
    m = makeMatch({ servingTeam: 'opponent' })
    await m.rally('us')            // played in R1, we rotate to R2 afterwards
    await m.rally('us')            // played in R2
    await m.rally('opponent')      // played in R2
    const points = m.events.filter(e => e.eventType === 'point')
    expect(points.map(e => e.rotation)).toEqual([1, 2, 2])
  })

  it('records the score, the side-out and the next server on each point event', async () => {
    m = makeMatch({ servingTeam: 'us' })
    await m.rally('opponent')
    expect(m.events[0]).toMatchObject({
      team: 'opponent', eventType: 'point', outcome: 'scored',
      payload: { ourScore: 0, opponentScore: 1, isSideOut: true, servingTeam: 'opponent' }
    })
  })

  it('stores the state before the rally so the point can be undone exactly', async () => {
    m = makeMatch({ servingTeam: 'opponent', ourScore: 7, opponentScore: 9 })
    await m.rally('us')
    expect(m.events[0].payload.before).toEqual({ ourScore: 7, opponentScore: 9, servingTeam: 'opponent', currentRotation: 1 })
    expect(m.events[0].payload.rotationId).toBe('r2')
  })

  it('a point without a side-out rotation records no rotation row', async () => {
    m = makeMatch({ servingTeam: 'us' })
    await m.rally('us')
    expect(m.events[0].payload.rotationId).toBeUndefined()
  })

  it('links the point to the coded event that won it', async () => {
    m = makeMatch({ servingTeam: 'us' })
    await m.rallyFrom('us', 'ev-ace')
    expect(m.events[0].payload.sourceEventId).toBe('ev-ace')
  })

  it('no rally can be recorded while a video challenge is under review', async () => {
    m = makeMatch({ servingTeam: 'us' })
    m.challenges.push({ id: 'c1', successful: null })
    await expect(m.rally('us')).rejects.toThrow('CHALLENGE_PENDING')
    expect(m.set.ourScore).toBe(0)
  })

  it('refuses to score in a finished set', async () => {
    m = makeMatch({ servingTeam: 'us' })
    m.set.status = 'finished'
    await expect(m.rally('us')).rejects.toThrow('SET_FINISHED')
  })
})

describe('scoring with the libero on court (FIVB 19.3.2)', () => {
  it('our side-out with the libero in for the player at 5 forces the libero off as that slot reaches 4', async () => {
    const m = makeMatch({ servingTeam: 'opponent', liberoFor: 'E', ourScore: 3, opponentScore: 4 })
    const { result } = await m.rally('us')
    expect(m.rotations[1].libero).toEqual({ onCourt: null, lastChangeRally: 8 })
    expect(result.rotationState.libero?.onCourt).toBeNull()
  })

  it('our side-out with the libero in for the player at 6 keeps the libero on', async () => {
    const m = makeMatch({ servingTeam: 'opponent', liberoFor: 'F' })
    await m.rally('us')
    expect(m.rotations[1].libero.onCourt).toMatchObject({ liberoId: 'L1', replacedPlayerId: 'F' })
  })

  it('a point that does not rotate us leaves the libero exactly where they are', async () => {
    const m = makeMatch({ servingTeam: 'us', liberoFor: 'E' })
    const { result } = await m.rally('opponent')
    expect(m.rotations).toHaveLength(1)
    expect(result.rotationState.libero?.onCourt).toMatchObject({ liberoId: 'L1', replacedPlayerId: 'E' })
  })

  it('the rotation order never contains the libero', async () => {
    const m = makeMatch({ servingTeam: 'opponent', liberoFor: 'F' })
    await m.rally('us')
    expect(m.onCourt()).toBe('BCDEFA')
  })
})

describe('ending a set by scoring (FIVB 6.2)', () => {
  it('24-23 then a point to us ends set 1 at 25-23', async () => {
    const m = makeMatch({ servingTeam: 'us', ourScore: 24, opponentScore: 23 })
    const { result, events } = await m.rally('us')
    expect(result.setOver).toBe(true)
    expect(m.set.status).toBe('finished')
    expect(events.map(e => e.name)).toEqual(['score_updated', 'set_finished'])
  })

  it('24-24 then a point does not end the set (needs a two-point lead)', async () => {
    const m = makeMatch({ servingTeam: 'us', ourScore: 24, opponentScore: 24 })
    const { result, events } = await m.rally('us')
    expect(result.setOver).toBe(false)
    expect(m.set.status).toBe('active')
    expect(events.map(e => e.name)).toEqual(['score_updated'])
  })

  it('the deciding set ends at 15 and the match ends with it', async () => {
    const m = makeMatch({ servingTeam: 'opponent', setNumber: 5, ourScore: 14, opponentScore: 13, previousSets: [[25, 20], [20, 25], [25, 22], [23, 25]] })
    const { result, events } = await m.rally('us')
    expect(result).toMatchObject({ setOver: true, matchOver: true, ourSetsWon: 3, opponentSetsWon: 2 })
    expect(m.match.status).toBe('completed')
    expect(events.map(e => e.name)).toEqual(['score_updated', 'set_finished', 'match_finished'])
    expect(events[2].payload).toEqual({ ourSetsWon: 3, opponentSetsWon: 2, winner: 'us' })
  })

  it('15-13 in set 4 does not end the set', async () => {
    const m = makeMatch({ servingTeam: 'us', setNumber: 4, ourScore: 14, opponentScore: 13 })
    const { result } = await m.rally('us')
    expect(result.setOver).toBe(false)
  })

  it('the opponent winning the third set 3-0 finishes the match as a loss', async () => {
    const m = makeMatch({ servingTeam: 'opponent', setNumber: 3, ourScore: 20, opponentScore: 24, previousSets: [[20, 25], [18, 25]] })
    const { result, events } = await m.rally('opponent')
    expect(result).toMatchObject({ matchOver: true, ourSetsWon: 0, opponentSetsWon: 3 })
    expect(events[2].payload).toMatchObject({ winner: 'opponent' })
  })
})


type FakeSet = { id: string; matchId: string; setNumber: number; status: string; ourScore: number; opponentScore: number }

const fakeSetsTx = (sets: FakeSet[]) => {
  const matchUpdate = vi.fn(async () => ({}))
  const tx = {
    matchSet: {
      update: vi.fn(async ({ where, data }: any) => Object.assign(sets.find(x => x.id === where.id)!, data)),
      findMany: vi.fn(async () => sets)
    },
    match: { update: matchUpdate }
  }
  return { tx: tx as unknown as Prisma.TransactionClient, matchUpdate }
}

const set = (n: number, us: number, them: number, status = 'finished'): FakeSet =>
  ({ id: `s${n}`, matchId: 'm1', setNumber: n, status, ourScore: us, opponentScore: them })

describe('completeSetWithin', () => {
  it('finishes a non-deciding set and only announces set_finished', async () => {
    const sets = [set(1, 25, 20), set(2, 25, 23, 'active')]
    const { tx, matchUpdate } = fakeSetsTx(sets)
    const result = await completeSetWithin(tx, sets[1], 'live')
    expect(sets[1].status).toBe('finished')
    expect(result.matchOver).toBe(false)
    expect(result.events.map(e => e.name)).toEqual(['set_finished'])
    expect(matchUpdate).not.toHaveBeenCalled()
  })

  it('completes the match and announces match_finished on the set that decides it', async () => {
    const sets = [set(1, 25, 20), set(2, 20, 25), set(3, 25, 18), set(4, 25, 23, 'active')]
    const { tx, matchUpdate } = fakeSetsTx(sets)
    const result = await completeSetWithin(tx, sets[3], 'live')
    expect(result).toMatchObject({ ourSetsWon: 3, opponentSetsWon: 1, matchOver: true })
    expect(result.events.map(e => e.name)).toEqual(['set_finished', 'match_finished'])
    expect(result.events[1].payload).toEqual({ ourSetsWon: 3, opponentSetsWon: 1, winner: 'us' })
    expect(matchUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }))
  })

  it('refuses to finish a set that is already finished', async () => {
    const sets = [set(1, 25, 20)]
    const { tx } = fakeSetsTx(sets)
    await expect(completeSetWithin(tx, sets[0], 'live')).rejects.toThrow('Invalid transition')
  })

  it('refuses to finish a set that has not reached its target', async () => {
    const sets = [set(1, 24, 22, 'active')]
    const { tx } = fakeSetsTx(sets)
    await expect(completeSetWithin(tx, sets[0], 'live')).rejects.toThrow('Set cannot end')
  })
})
