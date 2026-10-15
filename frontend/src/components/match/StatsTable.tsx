import { useState } from 'react'
import type { LiveSnapshot } from '../../lib/match/types'
import type { PlayerStats } from '../../types'
import { effBar, opponentTotals } from '../../lib/match/derive'
import { lastName } from '../../lib/match/labels'
import Pill from '../ui/Pill'

const pct = (total: number, value: number) => (total ? `${Math.round(value * 100)}%` : '—')

const StatsTable = ({ view, className = '' }: { view: LiveSnapshot; className?: string }) => {
  const [side, setSide] = useState<'us' | 'opponent'>('us')
  const numberOf = (id: string) => view.players.find(p => p.id === id)?.number ?? ''
  const ours = [...(view.liveStats?.players ?? [])].sort((a, b) => Number(numberOf(a.playerId)) - Number(numberOf(b.playerId)))
  const rows: { key: string; number: string; name: string; stats: PlayerStats }[] = side === 'us'
    ? ours.map(s => ({ key: s.playerId, number: numberOf(s.playerId), name: lastName(s.playerName), stats: s }))
    : [
        { key: 'opp', number: '', name: `${view.match.opponentName} (team, set)`, stats: opponentTotals(view.events) },
        ...(view.liveStats?.opponent ?? []).map(o => ({
          key: o.opponentPlayerId,
          number: String(o.jersey),
          name: o.name ?? `#${o.jersey}`,
          stats: { ...o, playerId: o.opponentPlayerId, playerName: o.name ?? `#${o.jersey}` }
        }))
      ]

  return (
    <section className={`flex flex-col min-h-0 ${className}`}>
      <div className="shrink-0 flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-widest text-muted">
          Live stats — {side === 'us' ? 'our team' : 'opponent'}
        </p>
        <div className="flex gap-1.5">
          <Pill selected={side === 'us'} tone="us" onClick={() => setSide('us')}>Our team</Pill>
          <Pill selected={side === 'opponent'} tone="opp" onClick={() => setSide('opponent')}>Opponent</Pill>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 grid content-start text-xs"
        style={{ gridTemplateRows: `auto repeat(${Math.max(rows.length, 1)}, minmax(0, 28px))` }}
      >
        <div className="grid grid-cols-[1.5rem_1fr_2.75rem_2.75rem_2.75rem_2rem_2.5rem] md:grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem_2.5rem_4rem] items-end gap-1.5 md:gap-2 text-[9px] uppercase tracking-widest text-muted pb-1 border-b border-line">
          <span>#</span><span>Player</span><span className="text-right">Atk</span><span className="text-right">Srv</span><span className="text-right">Rec</span><span className="text-right">Pts</span><span>Eff</span>
        </div>
        {rows.length === 0 && <p className="text-muted py-2">No events coded yet</p>}
        {rows.map(({ key, number, name, stats }, i) => {
          const eff = effBar(stats)
          return (
            <div key={key} className={`grid grid-cols-[1.5rem_1fr_2.75rem_2.75rem_2.75rem_2rem_2.5rem] md:grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem_2.5rem_4rem] items-center gap-1.5 md:gap-2 min-h-0 ${i % 2 ? 'bg-card' : ''}`}>
              <span className="text-us tabular-nums">{number}</span>
              <span className="text-white truncate">{name}</span>
              <span className="text-right tabular-nums text-libero">{pct(stats.attack.total, stats.attack.efficiency)}</span>
              <span className="text-right tabular-nums text-libero">{pct(stats.serve.total, stats.serve.efficiency)}</span>
              <span className="text-right tabular-nums text-libero">{pct(stats.reception.total, stats.reception.efficiency)}</span>
              <span className="text-right tabular-nums text-white font-semibold">{stats.totalPoints}</span>
              <span className="h-1 bg-line rounded overflow-hidden">
                <span className="block h-full bg-us transition-motion" style={{ width: `${(eff ?? 0) * 100}%` }} />
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default StatsTable
