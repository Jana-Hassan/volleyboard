import { describe, it, expect, vi, beforeEach } from 'vitest'

//sets 2-4 start with the team that did NOT serve first in the
// previous set, whoever won it. Sets 1 and 5 start with the toss winner.

const db = vi.hoisted(() => ({
  sets: [] as any[],
  firstPoints: {} as Record<string, any>,
  created: [] as any[]
}))

vi.mock('./row-lock', () => ({ lockSet: vi.fn(async () => {}), lockMatch: vi.fn(async () => {}) }))
vi.mock('./team-access', () => ({ requirePermission: vi.fn(async () => 'coach') }))
vi.mock('../events/event-bus', () => ({ publish: vi.fn(), publishAll: vi.fn() }))
vi.mock('../lib/prisma', () => {
  const lineup = {
    rotationSystem: 'custom',
    slots: ['A', 'B', 'C', 'D', 'E', 'F'].map((id, i) => ({
      playerId: id, role: 'starter', rotationPosition: i + 1, player: { id, name: id, isLibero: false }
    }))
  }
  const tx = {
    matchSet: {
      findFirst: vi.fn(async () => db.sets[db.sets.length - 1]),
      create: vi.fn(async ({ data }: any) => { const s = { id: `s${data.setNumber}`, ...data }; db.created.push(s); return s })
    },
    rotation: { create: vi.fn(async () => ({})) },
    match: {
      findUniqueOrThrow: vi.fn(async () => ({ id: 'm1', status: 'pending' })),
      update: vi.fn(async () => ({ id: 'm1', status: 'live' }))
    }
  }
  return {
    default: {
      match: {
        findUnique: vi.fn(async () => ({ id: 'm1', teamId: 't1', status: db.sets.length ? 'live' : 'pending', sets: db.sets, lineup }))
      },
      player: {
        findMany: vi.fn(async ({ where }: any) => where.id.in.map((id: string) => ({ id, teamId: 't1', name: id, position: 'outside', isLibero: false })))
      },
      matchEvent: {
        findFirst: vi.fn(async ({ where }: any) => db.firstPoints[where.setId] ?? null)
      },
      $transaction: vi.fn(async (fn: any) => fn(tx))
    }
  }
})

import { startMatch, startNextSet } from './match.service'

// A finished set whose first rally was served by `firstServer`.
const finishedSet = (n: number, us: number, them: number, firstServer: 'us' | 'opponent', firstRallyWonBy: 'us' | 'opponent') => {
  const id = `s${n}`
  db.sets.push({ id, setNumber: n, ourScore: us, opponentScore: them, status: 'finished' })
  db.firstPoints[id] = {
    payload: { servingTeam: firstRallyWonBy, isSideOut: firstRallyWonBy !== firstServer }
  }
}

beforeEach(() => {
  db.sets.length = 0
  db.created.length = 0
  for (const k of Object.keys(db.firstPoints)) delete db.firstPoints[k]
})

describe('first server of each set (FIVB 12.1)', () => {
  it('set 1 goes to the toss winner', async () => {
    await startMatch('m1', 'u1', 'opponent')
    expect(db.created[0]).toMatchObject({ setNumber: 1, servingTeam: 'opponent' })
  })

  it('set 1 without a toss result keeps the old default: we serve', async () => {
    await startMatch('m1', 'u1')
    expect(db.created[0]).toMatchObject({ setNumber: 1, servingTeam: 'us' })
  })

  it('set 2: we served first in set 1 and won it, yet they serve first', async () => {
    finishedSet(1, 25, 20, 'us', 'us')
    await startNextSet('m1', 'u1')
    expect(db.created[0]).toMatchObject({ setNumber: 2, servingTeam: 'opponent' })
  })

  it('set 2: we served first in set 1 and lost it, still they serve first', async () => {
    finishedSet(1, 20, 25, 'us', 'opponent')
    await startNextSet('m1', 'u1')
    expect(db.created[0]).toMatchObject({ setNumber: 2, servingTeam: 'opponent' })
  })

  it('set 3: they served first in set 2, so we serve first', async () => {
    finishedSet(1, 25, 20, 'us', 'us')
    finishedSet(2, 22, 25, 'opponent', 'us')   // first rally was a side-out by us
    await startNextSet('m1', 'u1')
    expect(db.created[0]).toMatchObject({ setNumber: 3, servingTeam: 'us' })
  })

  it('set 4 ignores a toss and alternates', async () => {
    finishedSet(1, 25, 20, 'us', 'opponent')
    finishedSet(2, 22, 25, 'opponent', 'opponent')
    finishedSet(3, 25, 23, 'us', 'us')
    await startNextSet('m1', 'u1', 'us')
    expect(db.created[0]).toMatchObject({ setNumber: 4, servingTeam: 'opponent' })
  })

  it('set 5 goes to the new toss winner, not by alternation', async () => {
    finishedSet(1, 25, 20, 'us', 'us')
    finishedSet(2, 22, 25, 'opponent', 'opponent')
    finishedSet(3, 25, 23, 'us', 'us')
    finishedSet(4, 23, 25, 'opponent', 'opponent')   // alternation alone would give us
    await startNextSet('m1', 'u1', 'opponent')
    expect(db.created[0]).toMatchObject({ setNumber: 5, servingTeam: 'opponent' })
  })

  it('the first set rotation state carries the first server', async () => {
    const result = await startMatch('m1', 'u1', 'opponent')
    expect(result.rotationState.servingTeam).toBe('opponent')
    expect(result.rotationState.currentRotation).toBe(1)
  })
})
