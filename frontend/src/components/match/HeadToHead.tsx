import type { LiveSnapshot } from '../../lib/match/types'
import { teamTotals } from '../../lib/match/derive'

const HeadToHead = ({ view, className = '' }: { view: LiveSnapshot; className?: string }) => {
  const us = teamTotals(view.events, 'us')
  const them = teamTotals(view.events, 'opponent')
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const rows: { label: string; us: number; them: number; show: (v: number) => string }[] = [
    { label: 'Attack eff.', us: us.attack.efficiency, them: them.attack.efficiency, show: pct },
    { label: 'Kills', us: us.attack.kills, them: them.attack.kills, show: String },
    { label: 'Aces', us: us.serve.aces, them: them.serve.aces, show: String },
    { label: 'Serve errors', us: us.serve.errors, them: them.serve.errors, show: String },
    { label: 'Reception eff.', us: us.reception.efficiency, them: them.reception.efficiency, show: pct },
    { label: 'Blocks', us: us.block.kills, them: them.block.kills, show: String }
  ]

  return (
    <section className={`shrink-0 ${className}`}>
      <div className="flex justify-between text-[10px] uppercase tracking-widest mb-1.5">
        <span className="text-us">{view.match.teamName.split(' ')[0]}</span>
        <span className="text-muted">Head to head · set {view.activeSet?.setNumber}</span>
        <span className="text-opp-soft">{view.match.opponentName}</span>
      </div>
      {rows.map(r => {
        const max = Math.max(Math.abs(r.us), Math.abs(r.them), 0.0001)
        return (
          <div key={r.label} className="grid grid-cols-[2.5rem_1fr_6rem_1fr_2.5rem] items-center gap-2 h-6 text-xs">
            <span className="text-right tabular-nums text-white">{r.show(r.us)}</span>
            <span className="flex justify-end"><span className="h-1.5 bg-us rounded-sm transition-motion" style={{ width: `${(Math.max(r.us, 0) / max) * 100}%` }} /></span>
            <span className="text-center text-[9px] uppercase tracking-widest text-muted truncate">{r.label}</span>
            <span className="flex"><span className="h-1.5 bg-opp-soft rounded-sm transition-motion" style={{ width: `${(Math.max(r.them, 0) / max) * 100}%` }} /></span>
            <span className="tabular-nums text-white">{r.show(r.them)}</span>
          </div>
        )
      })}
    </section>
  )
}

export default HeadToHead
