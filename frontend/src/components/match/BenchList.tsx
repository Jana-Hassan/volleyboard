import type { LiveSnapshot } from '../../lib/match/types'
import { benchStatus } from '../../lib/match/derive'
import type { BenchEntry } from '../../lib/match/derive'

interface BenchListProps {
  view: LiveSnapshot
  columns?: 1 | 2
  onLibero?: (liberoId: string) => void
  className?: string
}

const BenchList = ({ view, columns = 1, onLibero, className = '' }: BenchListProps) => {
  const entries = benchStatus(view.lineup, view.substitutions, view.court)
  const player = (id: string) => view.players.find(p => p.id === id)
  const setNo = view.activeSet?.setNumber ?? 1
  const subsLeft = 6 - (view.activeSet?.subCount ?? 0)

  const statusText = (e: BenchEntry) => {
    if (e.kind === 'libero') return e.status === 'on' ? 'On court' : 'Libero'
    if (e.kind === 'starter') return e.status === 'returns' ? `Back for #${player(e.pairId ?? '')?.number ?? ''}` : `Used · set ${setNo}`
    return e.status === 'on' ? 'On court' : e.status === 'used' ? `Used · set ${setNo}` : 'Available'
  }

  return (
    <section className={`flex flex-col min-h-0 ${className}`}>
      <div className="shrink-0 flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest text-muted">Bench</p>
        <p className="text-[10px] text-muted">{subsLeft} subs remaining</p>
      </div>
      <div className={`grid gap-x-3 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {entries.map(e => {
          const p = player(e.playerId)
          const dim = e.status === 'used' || e.status === 'done'
          const isLibero = e.kind === 'libero'
          const actionable = isLibero && onLibero
          return (
            <button
              key={e.playerId}
              type="button"
              disabled={!actionable}
              onClick={() => actionable && onLibero!(e.playerId)}
              className={`h-8 flex items-center gap-2 text-left text-xs border-b border-line/60 ${actionable ? 'pointer-coarse:h-11 hover:bg-card cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center text-[10px] tabular-nums ${isLibero ? 'border-libero text-libero' : 'border-line text-white'}`}>
                {p?.number}
              </span>
              <span className={`flex-1 truncate ${dim ? 'text-muted line-through' : 'text-white'}`}>{p?.name}</span>
              <span className="text-[9px] uppercase tracking-widest text-libero hidden xl:inline">{p?.position.slice(0, 3)}</span>
              <span className={`text-[9px] uppercase tracking-widest ${e.status === 'available' || e.status === 'returns' ? 'text-us' : e.status === 'on' ? 'text-white' : 'text-muted'}`}>
                {statusText(e)}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default BenchList
