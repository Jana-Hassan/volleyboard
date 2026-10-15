import type { LiveSnapshot } from '../../lib/match/types'
import { pointFeed } from '../../lib/match/derive'
import { useFitCount } from '../../hooks/useFitCount'

const ROW = 26

const PointFeed = ({ view, className = '' }: { view: LiveSnapshot; className?: string }) => {
  const [ref, fit] = useFitCount<HTMLDivElement>(ROW)
  const entries = pointFeed(view.events, view.players)
  const shown = entries.slice(0, fit)

  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <p className="shrink-0 text-[10px] uppercase tracking-widest text-muted mb-1">
        Point by point
        {entries.length > shown.length && <span className="ml-2 normal-case tracking-normal">latest {shown.length} of {entries.length}</span>}
      </p>
      <div ref={ref} className="flex-1 min-h-0">
        {entries.length === 0 && <p className="text-xs text-muted">No rallies yet</p>}
        {shown.map(e => (
          <div key={e.id} style={{ height: ROW }} className={`flex items-center gap-2 text-xs border-b border-line/60 ${e.pending ? 'opacity-60' : ''}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.team === 'us' ? 'bg-us' : 'bg-opp'}`} />
            <span className="tabular-nums text-white w-12 shrink-0">{e.score ?? '…'}</span>
            <span className="truncate text-libero">{e.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PointFeed
