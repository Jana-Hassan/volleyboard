import { describe, it, expect, vi } from 'vitest'


const roster = vi.hoisted(() => {
  const p = (id: string, position: string, isLibero = false) => ({ id, teamId: 't1', name: id, position, isLibero })
  return [
    p('S1', 'setter'), p('O1', 'opposite'), p('M1', 'middle'), p('M2', 'middle'),
    p('H1', 'outside'), p('H2', 'outside'), p('H3', 'outside'), p('S2', 'setter'),
    p('L1', 'libero', true), p('L2', 'libero', true), p('L3', 'libero', true)
  ]
})

vi.mock('../lib/prisma', () => ({
  default: {
    player: {
      findMany: vi.fn(async ({ where }: any) => roster.filter(r => where.id.in.includes(r.id)))
    }
  }
}))

import { validateLineupSlots } from './lineup.service'

const starters = (ids = ['S1', 'O1', 'M1', 'M2', 'H1', 'H2']) =>
  ids.map((playerId, i) => ({ playerId, role: 'starter', rotationPosition: i + 1 }))
const as = (role: string, ...ids: string[]) => ids.map(playerId => ({ playerId, role, rotationPosition: null }))
const check = (slots: any[], system = '5-1') => validateLineupSlots('t1', slots, system)

describe('lineup composition', () => {
  it('six starters and no libero is a valid lineup (a libero is optional)', async () => {
    await expect(check(starters())).resolves.toBeUndefined()
  })

  it('six starters plus one or two liberos is valid', async () => {
    await expect(check([...starters(), ...as('libero', 'L1')])).resolves.toBeUndefined()
    await expect(check([...starters(), ...as('libero', 'L1', 'L2'), ...as('bench', 'H3', 'S2')])).resolves.toBeUndefined()
  })

  it('a libero can never be one of the six starters', async () => {
    await expect(check(starters(['S1', 'O1', 'M1', 'M2', 'H1', 'L1']))).rejects.toThrow('LIBERO_AS_STARTER')
  })

  it('at most two liberos', async () => {
    await expect(check([...starters(), ...as('libero', 'L1', 'L2', 'L3')])).rejects.toThrow('TOO_MANY_LIBEROS')
  })

  it('only a player registered as libero can take a libero slot', async () => {
    await expect(check([...starters(), ...as('libero', 'H3')])).rejects.toThrow('NOT_A_LIBERO')
  })

  it('a registered libero cannot sit on the bench as a regular substitute', async () => {
    await expect(check([...starters(), ...as('bench', 'L1')])).rejects.toThrow('LIBERO_ON_BENCH')
  })

  it('a registered libero may be left out of the match (reserved)', async () => {
    await expect(check([...starters(), ...as('reserved', 'L1')])).resolves.toBeUndefined()
  })

  it('needs exactly six starters', async () => {
    await expect(check(starters(['S1', 'O1', 'M1', 'M2', 'H1']))).rejects.toThrow('INVALID_STARTER_COUNT')
    await expect(check([...starters(), { playerId: 'H3', role: 'starter', rotationPosition: 6 }])).rejects.toThrow('INVALID_STARTER_COUNT')
  })

  it('each starter in a distinct position 1-6', async () => {
    const dup = starters().map(s => s.playerId === 'H2' ? { ...s, rotationPosition: 1 } : s)
    await expect(check(dup)).rejects.toThrow('DUPLICATE_ROTATION_POSITION')
    const bad = starters().map(s => s.playerId === 'H2' ? { ...s, rotationPosition: 7 } : s)
    await expect(check(bad)).rejects.toThrow('INVALID_ROTATION_POSITION')
  })

  it('rejects unknown slot roles and players from other teams', async () => {
    await expect(check([...starters(), ...as('captain', 'H3')])).rejects.toThrow('INVALID_ROLE')
    await expect(check([...starters(), ...as('bench', 'X9')])).rejects.toThrow('INVALID_PLAYERS')
  })

  it('setter count follows the rotation system', async () => {
    await expect(check(starters(['S1', 'O1', 'M1', 'M2', 'H1', 'S2']), '5-1')).rejects.toThrow('INVALID_SETTER_COUNT_5_1')
    await expect(check(starters(), '6-2')).rejects.toThrow('INVALID_SETTER_COUNT_6_2')
    await expect(check(starters(['S1', 'O1', 'M1', 'M2', 'H1', 'S2']), '6-2')).resolves.toBeUndefined()
  })
})
