import { useLayoutEffect, useRef, useState } from 'react'

export const useFitCount = <T extends HTMLElement>(itemSize: number, axis: 'height' | 'width' = 'height') => {
  const ref = useRef<T | null>(null)
  const [count, setCount] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (size: number) => setCount(Math.max(0, Math.floor(size / itemSize)))
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      measure(rect ? rect[axis] : 0)
    })
    observer.observe(el)
    const rect = el.getBoundingClientRect()
    measure(axis === 'height' ? rect.height : rect.width)
    return () => observer.disconnect()
  }, [itemSize, axis])

  return [ref, count] as const
}
