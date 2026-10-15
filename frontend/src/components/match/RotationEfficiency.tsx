import type { LiveSnapshot } from '../../lib/match/types'
import { rotationEfficiency } from '../../lib/match/derive'

const RotationEfficiency = ({ view, className = '' }: { view: LiveSnapshot; className?: string }) => {
  const rows = rotationEfficiency(view.events)
  const max = Math.max(1, ...rows.flatMap(r => [r.won, r.lost]))
  const current = view.activeSet?.currentRotation

  return (
    <section className={`flex flex-col min-h-0 ${className}`}>
      <p className="shrink-0 text-[10px] uppercase tracking-widest text-muted mb-2">Rotation efficiency — set {view.activeSet?.setNumber}</p>
      <div className="flex-1 min-h-0 grid grid-rows-6 gap-1">
        {rows.map(r => (
          <div
            key={r.rotation}
            className={`min-h-0 grid grid-cols-[2.5rem_1fr_1fr_2.5rem] items-center gap-2 px-2 rounded border transition-motion ${r.rotation === current ? 'border-us bg-card' : 'border-transparent'}`}
          >
            <span className="text-sm font-semibold text-white">R{r.rotation}</span>
            <span className="flex justify-end">
              <span className="h-2.5 bg-opp rounded-sm transition-motion" style={{ width: `${(r.lost / max) * 100}%` }} />
            </span>
            <span className="flex">
              <span className="h-2.5 bg-us rounded-sm transition-motion" style={{ width: `${(r.won / max) * 100}%` }} />
            </span>
            <span className={`text-right text-sm font-semibold tabular-nums ${r.net > 0 ? 'text-us' : r.net < 0 ? 'text-opp' : 'text-muted'}`}>
              {r.net > 0 ? `+${r.net}` : r.net}
            </span>
          </div>
        ))}
      </div>
      <div className="shrink-0 flex gap-4 mt-2 text-[10px] uppercase tracking-widest text-muted">
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-opp rounded-sm" />Lost</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-2 bg-us rounded-sm" />Won</span>
      </div>
    </section>
  )
}

export default RotationEfficiency
