import { useNavigate } from 'react-router-dom'
import type { LiveSnapshot } from '../../lib/match/types'

export type ViewKind = 'analyst' | 'coach' | 'readonly'

interface MatchTopBarProps {
  view: LiveSnapshot
  connected: boolean
  viewKind: ViewKind
  onViewKind?: (kind: ViewKind) => void
}

const VIEW_LABELS: { kind: ViewKind; label: string }[] = [
  { kind: 'analyst', label: 'Analyst' },
  { kind: 'coach', label: 'Coach' },
  { kind: 'readonly', label: 'Viewer' }
]

const MatchTopBar = ({ view, connected, viewKind, onViewKind }: MatchTopBarProps) => {
  const navigate = useNavigate()
  const live = view.match.status === 'live'
  const setNumber = view.activeSet?.setNumber ?? view.sets.length

  return (
    <header className="shrink-0 h-12 px-4 md:px-6 grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line">
      <button type="button" onClick={() => navigate('/dashboard')} className="text-white font-bold tracking-tight text-sm text-left hover:text-opp transition-motion-fast pointer-coarse:min-h-11">
        Volley<span className="text-us">Board</span>
      </button>

      <button
        type="button"
        onClick={() => navigate(`/teams/${view.match.teamId}?tab=matches`)}
        className="text-sm text-white truncate text-center hover:text-libero transition-motion-fast"
      >
        <span className="hidden sm:inline">{view.match.teamName}</span>
        <span className="sm:hidden">{view.match.teamName.split(' ')[0]}</span>
        <span className="text-muted"> vs </span>
        {view.match.opponentName}
      </button>

      <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest">
        {onViewKind && (
          <div className="hidden md:flex gap-1">
            {VIEW_LABELS.map(v => (
              <button
                key={v.kind}
                type="button"
                onClick={() => onViewKind(v.kind)}
                className={`px-2 py-1 rounded transition-motion-fast ${viewKind === v.kind ? 'bg-line text-white' : 'text-muted hover:text-white'}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
        {live ? (
          <span className="flex items-center gap-1.5 text-us">
            <span className="w-1.5 h-1.5 rounded-full bg-opp animate-pulse" />
            Live
          </span>
        ) : (
          <span className="text-muted">{view.match.status === 'completed' ? 'Final' : 'Not started'}</span>
        )}
        {live && <span className="text-muted hidden sm:inline">Set {setNumber}/5</span>}
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-us' : 'bg-opp'}`} title={connected ? 'Synced' : 'Offline'} />
      </div>
    </header>
  )
}

export default MatchTopBar
