import { describe, it, expect, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { stampWithin } from './set-version'
import type { AnyDomainEvent } from '../events/domain-events'

const fakeTx = (version: number) => {
  const set = { id: 's1', version }
  const tx = {
    matchSet: {
      update: vi.fn(async ({ data }: any) => {
        set.version += data.version.increment
        return { ...set }
      })
    }
  }
  return { tx: tx as unknown as Prisma.TransactionClient, set }
}

const ev = (name: string): AnyDomainEvent =>
  ({ name, matchId: 'm1', payload: { ourSetsWon: 0, opponentSetsWon: 0, winner: 'us' } }) as unknown as AnyDomainEvent

describe('set versions', () => {
  it('numbers each event of a transaction consecutively after the current version', async () => {
    const { tx, set } = fakeTx(7)
    const stamped = await stampWithin(tx, 's1', [ev('score_updated'), ev('set_finished'), ev('match_finished')])
    expect(stamped.map(e => (e.payload as any).version)).toEqual([8, 9, 10])
    expect(set.version).toBe(10)
  })

  it('tags every event with its set', async () => {
    const { tx } = fakeTx(0)
    const stamped = await stampWithin(tx, 's1', [ev('timeout_called')])
    expect(stamped[0].payload).toMatchObject({ setId: 's1', version: 1 })
  })

  it('two transactions in a row continue the same sequence with no gap', async () => {
    const { tx } = fakeTx(0)
    const a = await stampWithin(tx, 's1', [ev('score_updated')])
    const b = await stampWithin(tx, 's1', [ev('event_logged'), ev('score_updated')])
    expect([...a, ...b].map(e => (e.payload as any).version)).toEqual([1, 2, 3])
  })

  it('a transaction with nothing to announce does not move the version', async () => {
    const { tx, set } = fakeTx(4)
    expect(await stampWithin(tx, 's1', [])).toEqual([])
    expect(set.version).toBe(4)
  })

  it('keeps the original payload fields', async () => {
    const { tx } = fakeTx(0)
    const [stamped] = await stampWithin(tx, 's1', [ev('match_finished')])
    expect(stamped.payload).toMatchObject({ ourSetsWon: 0, opponentSetsWon: 0, winner: 'us' })
  })
})
