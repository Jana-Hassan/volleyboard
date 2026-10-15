export type PresenceState = 'present' | 'entering' | 'exiting'

export interface PresenceItem<T> {
  key: string
  item: T
  state: PresenceState
}

export const initialPresence = <T>(items: T[], keyOf: (item: T) => string): PresenceItem<T>[] =>
  items.map(item => ({ key: keyOf(item), item, state: 'present' }))

export const reconcilePresence = <T>(
  previous: PresenceItem<T>[],
  next: T[],
  keyOf: (item: T) => string
): PresenceItem<T>[] => {
  const before = new Map(previous.map(p => [p.key, p]))
  const nextKeys = new Set(next.map(keyOf))

  const current: PresenceItem<T>[] = next.map(item => {
    const key = keyOf(item)
    const was = before.get(key)
    const state: PresenceState = !was ? 'entering' : was.state === 'entering' ? 'entering' : 'present'
    return { key, item, state }
  })

  const leaving: PresenceItem<T>[] = previous
    .filter(p => !nextKeys.has(p.key))
    .map(p => ({ ...p, state: 'exiting' }))

  return [...current, ...leaving]
}

export const settlePresence = <T>(list: PresenceItem<T>[], key: string): PresenceItem<T>[] => {
  const target = list.find(p => p.key === key)
  if (!target || target.state === 'present') return list
  if (target.state === 'exiting') return list.filter(p => p.key !== key)
  return list.map(p => (p.key === key ? { ...p, state: 'present' } : p))
}
