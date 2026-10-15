import { useState } from 'react'
import type { ReactNode } from 'react'
import { useFitCount } from '../../hooks/useFitCount'

interface FitListProps<T> {
  items: T[]
  rowHeight: number
  keyOf: (item: T) => string
  renderRow: (item: T) => ReactNode
  empty: string
  header?: ReactNode
  className?: string
  columns?: number
}

const FitList = <T,>({ items, rowHeight, keyOf, renderRow, empty, header, className = '', columns = 1 }: FitListProps<T>) => {
  const [ref, fit] = useFitCount<HTMLDivElement>(rowHeight)
  const [page, setPage] = useState(0)
  const perPage = Math.max(1, fit) * columns
  const pages = Math.max(1, Math.ceil(items.length / perPage))
  const current = Math.min(page, pages - 1)
  const shown = items.slice(current * perPage, current * perPage + perPage)

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {header}
      <div ref={ref} className="flex-1 min-h-0">
        {items.length === 0 && <p className="text-xs text-muted py-2">{empty}</p>}
        {fit > 0 && (
          <div className="grid gap-x-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {shown.map(item => (
              <div key={keyOf(item)} style={{ height: rowHeight }}>{renderRow(item)}</div>
            ))}
          </div>
        )}
      </div>
      {pages > 1 && (
        <div className="shrink-0 flex items-center justify-end gap-3 pt-2 text-[10px] uppercase tracking-widest text-muted">
          <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="px-2 hover:text-white disabled:opacity-30 pointer-coarse:min-h-11">‹ Prev</button>
          <span className="tabular-nums">{current + 1} / {pages}</span>
          <button type="button" disabled={current === pages - 1} onClick={() => setPage(current + 1)} className="px-2 hover:text-white disabled:opacity-30 pointer-coarse:min-h-11">Next ›</button>
        </div>
      )}
    </div>
  )
}

export default FitList
