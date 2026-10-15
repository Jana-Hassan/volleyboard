import type { LiveSnapshot } from '../../lib/match/types'
import { playerEfficiency } from '../../lib/match/derive'
import { lastName } from '../../lib/match/labels'

const ARROWS = { up: '↑', down: '↓', flat: '→' }

const PlayerEfficiencyList = ({ view, className = '' }: { view: LiveSnapshot; className?: string }) => {
  const positions = view.court?.currentPositions ?? {}
  const onCourt = [1, 2, 3, 4, 5, 6].map(p => positions[String(p)]).filter(Boolean)

  return (
    <section className={`flex flex-col min-h-0 ${className}`}>
      <p className="shrink-0 text-[10px] uppercase tracking-widest text-muted mb-2">Live efficiency</p>
      <div className="flex-1 min-h-0 grid grid-rows-6 gap-1">
        {onCourt.map(p => {
          const player = view.players.find(pl => pl.id === p.playerId)
          const stats = view.liveStats?.players.find(s => s.playerId === p.playerId)
          const eff = stats ? playerEfficiency(stats, view.events) : null
          const tone = eff?.tone === 'low' ? 'text-opp' : eff?.tone === 'high' ? 'text-us' : 'text-white'
          const arrowTone = eff?.trend === 'up' ? 'text-us' : eff?.trend === 'down' ? 'text-opp' : 'text-muted'
          return (
            <div key={p.playerId} className="min-h-0 grid grid-cols-[2.5rem_1fr_2.5rem_3.5rem_1.25rem] items-center gap-2 px-2 rounded bg-card">
              <span className="text-us font-semibold tabular-nums">#{player?.number}</span>
              <span className={`truncate font-medium ${p.isLibero ? 'text-libero' : 'text-white'}`}>{lastName(p.playerName)}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted">{eff?.skill ?? '—'}</span>
              <span className={`text-right text-lg font-semibold tabular-nums ${tone}`}>{eff ? `${Math.round(eff.value * 100)}%` : '—'}</span>
              <span className={`text-center ${arrowTone}`}>{eff?.trend ? ARROWS[eff.trend] : ''}</span>
            </div>
          )
        })}
      </div>
      <p className="shrink-0 text-[10px] text-muted mt-2">Burgundy below 30% · green above 60% · arrow is the last three attempts</p>
    </section>
  )
}

export default PlayerEfficiencyList
