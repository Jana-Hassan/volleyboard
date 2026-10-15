import type { LiveEvent } from '../../lib/match/types'
import { momentum } from '../../lib/match/derive'

interface MomentumStripProps {
  events: LiveEvent[]
  teamName: string
  opponentName: string
}

const MomentumStrip = ({ events, teamName, opponentName }: MomentumStripProps) => {
  const m = momentum(events)
  const slots = Array.from({ length: 10 }, (_, i) => m.rallies[m.rallies.length - 10 + i] ?? null)

  return (
    <div className="flex items-center gap-3" aria-label="Momentum, last ten rallies">
      <div className="flex gap-0.5">
        {slots.map((team, i) => (
          <span
            key={i}
            className={`w-2.5 h-3.5 rounded-sm transition-motion ${team === 'us' ? 'bg-us' : team === 'opponent' ? 'bg-opp' : 'bg-line'}`}
          />
        ))}
      </div>
      <span className={`text-[10px] uppercase tracking-widest tabular-nums ${m.run?.team === 'us' ? 'text-us' : m.run ? 'text-opp' : 'text-muted'}`}>
        {m.run && m.run.length >= 2
          ? `${m.run.team === 'us' ? teamName.split(' ')[0] : opponentName} ${m.run.length}–0 run`
          : 'No run'}
      </span>
    </div>
  )
}

export default MomentumStrip
