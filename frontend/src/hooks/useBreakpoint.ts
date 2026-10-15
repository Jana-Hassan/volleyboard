import { useSyncExternalStore } from 'react'

export type Breakpoint = 'phone' | 'tablet' | 'laptop'

const PHONE = '(max-width: 767px)'
const LAPTOP = '(min-width: 1280px)'

const read = (): Breakpoint =>
  window.matchMedia(PHONE).matches ? 'phone' : window.matchMedia(LAPTOP).matches ? 'laptop' : 'tablet'

const subscribe = (onChange: () => void) => {
  const lists = [window.matchMedia(PHONE), window.matchMedia(LAPTOP)]
  lists.forEach(l => l.addEventListener('change', onChange))
  return () => lists.forEach(l => l.removeEventListener('change', onChange))
}

export const useBreakpoint = (): Breakpoint => useSyncExternalStore(subscribe, read, () => 'laptop')
