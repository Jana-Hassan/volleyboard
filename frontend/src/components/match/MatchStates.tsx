import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { LiveSnapshot, Team } from '../../lib/match/types'
import type { MatchLive } from '../../hooks/useMatchLive'
import Button from '../ui/Button'
import Pill from '../ui/Pill'
import SetStrip from './SetStrip'

interface StateProps {
  view: LiveSnapshot
  live: MatchLive
  canControl: boolean
  onOpenRoster?: () => void
}

const Toss = ({ view, value, onChange }: { view: LiveSnapshot; value: Team; onChange: (t: Team) => void }) => (
  <div className="mt-5">
    <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Toss — who serves first?</p>
    <div className="flex justify-center gap-2">
      <Pill selected={value === 'us'} tone="us" onClick={() => onChange('us')}>{view.match.teamName}</Pill>
      <Pill selected={value === 'opponent'} tone="opp" onClick={() => onChange('opponent')}>{view.match.opponentName}</Pill>
    </div>
  </div>
)

const Panel = ({ children }: { children: ReactNode }) => (
  <div className="flex-1 min-h-0 flex items-center justify-center p-6">
    <div className="w-full max-w-md border border-line bg-card rounded p-8 text-center">{children}</div>
  </div>
)

export const PreMatch = ({ view, live, canControl, onOpenRoster }: StateProps) => {
  const [toss, setToss] = useState<Team>('us')
  const when = view.match.scheduledAt
    ? new Date(view.match.scheduledAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Date not set'
  return (
    <Panel>
      <p className="text-white text-sm">Match has not started</p>
      <p className="text-muted text-xs mt-1">{view.match.competition} · {when}</p>
      {onOpenRoster && (
        <Button tone="neutral" className="mt-4" onClick={onOpenRoster}>
          {view.match.opponentName} roster · {view.opponentPlayers.length}
        </Button>
      )}
      {canControl ? (
        <>
          <Toss view={view} value={toss} onChange={setToss} />
          <Button tone="primary" size="lg" className="mt-6 w-full" disabled={live.busy} onClick={() => live.startMatch(toss)}>
            {live.busy ? 'Starting…' : 'Start match'}
          </Button>
        </>
      ) : (
        <p className="text-muted text-xs mt-5">Waiting for the coach to start the match</p>
      )}
    </Panel>
  )
}

export const BetweenSets = ({ view, live, canControl }: StateProps) => {
  const [toss, setToss] = useState<Team>('us')
  const last = view.sets[view.sets.length - 1]
  const nextNumber = (last?.setNumber ?? 0) + 1
  return (
    <Panel>
      <p className="text-[10px] uppercase tracking-widest text-muted">Set {last?.setNumber} finished</p>
      <p className="text-3xl font-bold tabular-nums mt-2">{last?.ourScore}–{last?.opponentScore}</p>
      <div className="flex justify-center mt-4"><SetStrip view={view} /></div>
      {canControl ? (
        <>
          {nextNumber === 5 && <Toss view={view} value={toss} onChange={setToss} />}
          <Button tone="primary" size="lg" className="mt-6 w-full" disabled={live.busy} onClick={() => live.nextSet(nextNumber === 5 ? toss : undefined)}>
            {live.busy ? 'Starting…' : `Start set ${nextNumber}`}
          </Button>
        </>
      ) : (
        <p className="text-muted text-xs mt-5">Waiting for set {nextNumber}</p>
      )}
    </Panel>
  )
}

export const MatchFinal = ({ view }: { view: LiveSnapshot }) => {
  const navigate = useNavigate()
  const won = view.ourSetsWon > view.opponentSetsWon
  return (
    <Panel>
      <p className={`text-3xl font-bold ${won ? 'text-us' : 'text-opp'}`}>{won ? 'Win' : 'Loss'}</p>
      <p className="text-muted text-sm mt-2">{view.match.teamName} {view.ourSetsWon} — {view.opponentSetsWon} {view.match.opponentName}</p>
      <div className="flex justify-center mt-4"><SetStrip view={view} /></div>
      <Button tone="primary" size="lg" className="mt-6 w-full" onClick={() => navigate(`/matches/${view.match.id}/report`)}>View report</Button>
    </Panel>
  )
}
