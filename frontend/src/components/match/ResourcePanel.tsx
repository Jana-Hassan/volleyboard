import type { ActiveSet } from '../../lib/match/types'
import ResourceBar from '../ui/ResourceBar'

const MAX = { subs: 6, timeouts: 2, challenges: 2 }

const used = (set: ActiveSet) => [
  { label: 'Substitutions', short: 'Subs', used: set.subCount, total: MAX.subs },
  { label: 'Timeouts', short: 'Timeouts', used: MAX.timeouts - set.ourTimeoutsRemaining, total: MAX.timeouts },
  { label: 'Challenges', short: 'Challenges', used: MAX.challenges - set.ourChallengesRemaining, total: MAX.challenges }
]

const ResourcePanel = ({ set, variant = 'bars' }: { set: ActiveSet; variant?: 'bars' | 'strip' }) => {
  if (variant === 'strip') {
    return (
      <div className="grid grid-cols-3 gap-4">
        {used(set).map(r => (
          <div key={r.label}>
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] uppercase tracking-widest text-muted">{r.short}</span>
              <span className="text-lg md:text-2xl font-bold tabular-nums">{r.used}/{r.total}</span>
            </div>
            <div className="h-1 bg-line rounded overflow-hidden mt-1">
              <div className="h-full bg-us transition-motion" style={{ width: `${(r.used / r.total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      {used(set).map(r => <ResourceBar key={r.label} label={r.label} used={r.used} total={r.total} />)}
    </div>
  )
}

export default ResourcePanel
