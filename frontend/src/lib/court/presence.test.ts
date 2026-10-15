import { describe, it, expect } from 'vitest'
import { reconcilePresence, settlePresence, initialPresence } from './presence'

type P = { id: string; position: number }
const key = (p: P) => p.id
const six = (ids = 'ABCDEF') => ids.split('').map((id, i) => ({ id, position: i + 1 }))
const states = (list: ReturnType<typeof initialPresence<P>>) => list.map(i => `${i.key}:${i.state}`).join(' ')

describe('court presence', () => {
  it('players on court at first render are simply there, nothing animates in', () => {
    expect(states(initialPresence(six(), key))).toBe('A:present B:present C:present D:present E:present F:present')
  })

  it('a rotation keeps all six players and only moves them', () => {
    const rotated = six('BCDEFA')
    const next = reconcilePresence(initialPresence(six(), key), rotated, key)
    expect(next.every(i => i.state === 'present')).toBe(true)
    expect(next.find(i => i.key === 'B')?.item.position).toBe(1)
  })

  it('a substitution brings the new player in and takes the old one out', () => {
    const next = reconcilePresence(initialPresence(six(), key), six('XBCDEF'), key)
    expect(next.find(i => i.key === 'X')?.state).toBe('entering')
    expect(next.find(i => i.key === 'A')?.state).toBe('exiting')
  })

  it('the leaving player stays where they stood until their exit finishes', () => {
    const next = reconcilePresence(initialPresence(six(), key), six('XBCDEF'), key)
    expect(next.find(i => i.key === 'A')?.item.position).toBe(1)
  })

  it('a finished exit removes the player; a finished entrance makes them present', () => {
    let list = reconcilePresence(initialPresence(six(), key), six('XBCDEF'), key)
    list = settlePresence(list, 'A')
    list = settlePresence(list, 'X')
    expect(states(list)).toBe('X:present B:present C:present D:present E:present F:present')
  })

  it('a player still entering stays entering through another update', () => {
    let list = reconcilePresence(initialPresence(six(), key), six('XBCDEF'), key)
    list = reconcilePresence(list, six('XCDEFB'), key)
    expect(list.find(i => i.key === 'X')?.state).toBe('entering')
  })

  it('a player who comes back while still leaving is simply present again', () => {
    let list = reconcilePresence(initialPresence(six(), key), six('XBCDEF'), key)
    list = reconcilePresence(list, six(), key)
    expect(list.find(i => i.key === 'A')?.state).toBe('present')
    expect(list.filter(i => i.key === 'A')).toHaveLength(1)
  })

  it('settling a key that is not animating changes nothing', () => {
    const list = initialPresence(six(), key)
    expect(settlePresence(list, 'A')).toBe(list)
  })

  it('does not mutate what it was given', () => {
    const start = initialPresence(six(), key)
    const snapshot = JSON.stringify(start)
    reconcilePresence(start, six('XBCDEF'), key)
    expect(JSON.stringify(start)).toBe(snapshot)
  })
})
