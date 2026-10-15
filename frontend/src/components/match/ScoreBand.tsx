import type { LiveSnapshot } from '../../lib/match/types'
import AnimatedNumber from '../ui/AnimatedNumber'
import SetStrip from './SetStrip'
import MomentumStrip from './MomentumStrip'

interface ScoreBandProps {
  view: LiveSnapshot
  variant: 'compact' | 'hero' | 'phone'
}

const Serving = ({ show, tone }: { show: boolean; tone: 'us' | 'opp' }) => (
  <span className={`text-[10px] uppercase tracking-widest ${tone === 'us' ? 'text-us' : 'text-opp'} ${show ? '' : 'invisible'}`}>
    ▲ Serving
  </span>
)

const ScoreBand = ({ view, variant }: ScoreBandProps) => {
  const set = view.activeSet
  const us = set?.ourScore ?? 0
  const them = set?.opponentScore ?? 0
  const serving = set?.status === 'active' ? set.servingTeam : null
  const setsLine = `Sets: ${view.match.teamName} ${view.ourSetsWon} — ${view.opponentSetsWon} ${view.match.opponentName}`

  if (variant === 'hero') {
    return (
      <section className="shrink-0 border-b border-line bg-card px-6 py-4 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted truncate">{view.match.teamName}</p>
          <AnimatedNumber value={us} className="font-bold leading-none text-[clamp(56px,12vh,132px)]" />
          <div><Serving show={serving === 'us'} tone="us" /></div>
        </div>
        <div className="flex flex-col items-center gap-3 min-w-0">
          <p className="text-sm text-muted text-center">{setsLine}</p>
          <SetStrip view={view} />
          <MomentumStrip events={view.events} teamName={view.match.teamName} opponentName={view.match.opponentName} />
        </div>
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-opp truncate">{view.match.opponentName}</p>
          <AnimatedNumber value={them} className="font-bold leading-none text-[clamp(56px,12vh,132px)]" />
          <div><Serving show={serving === 'opponent'} tone="opp" /></div>
        </div>
      </section>
    )
  }

  if (variant === 'phone') {
    return (
      <section className="shrink-0 border-b border-line bg-card px-4 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="text-center min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted truncate">{view.match.teamName}</p>
            <AnimatedNumber value={us} className="text-5xl font-bold leading-none" />
            <div><Serving show={serving === 'us'} tone="us" /></div>
          </div>
          <span className="text-muted">—</span>
          <div className="text-center min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-opp truncate">{view.match.opponentName}</p>
            <AnimatedNumber value={them} className="text-5xl font-bold leading-none" />
            <div><Serving show={serving === 'opponent'} tone="opp" /></div>
          </div>
        </div>
        <p className="text-center text-xs text-muted mt-1 truncate">{setsLine}</p>
      </section>
    )
  }

  return (
    <section className="shrink-0 border-b border-line bg-card px-6 py-2">
      <div className="flex items-center justify-center gap-6">
        <div className="text-right min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted truncate">{view.match.teamName}</p>
          <Serving show={serving === 'us'} tone="us" />
        </div>
        <AnimatedNumber value={us} className="text-5xl xl:text-6xl font-bold leading-none min-w-[2ch] text-right" />
        <span className="text-muted">—</span>
        <AnimatedNumber value={them} className="text-5xl xl:text-6xl font-bold leading-none min-w-[2ch]" />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-opp truncate">{view.match.opponentName}</p>
          <Serving show={serving === 'opponent'} tone="opp" />
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 mt-1.5">
        <p className="text-xs text-muted">{setsLine}</p>
        <SetStrip view={view} />
      </div>
    </section>
  )
}

export default ScoreBand
