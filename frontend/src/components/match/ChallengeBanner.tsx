import type { LiveSnapshot } from '../../lib/match/types'
import type { MatchLive } from '../../hooks/useMatchLive'
import { CHALLENGE_TYPES } from '../../lib/match/labels'
import Button from '../ui/Button'

interface ChallengeBannerProps {
  view: LiveSnapshot
  live: MatchLive
  canResolve: boolean
}

const ChallengeBanner = ({ view, live, canResolve }: ChallengeBannerProps) => {
  const pending = view.challenges.find(c => c.successful === null)
  if (!pending) return null
  const team = pending.challenger === 'us' ? view.match.teamName : view.match.opponentName
  const call = CHALLENGE_TYPES.find(t => t.key === pending.callType)?.label ?? pending.callType

  return (
    <div className="shrink-0 number-tick border-b border-line bg-card px-4 md:px-6 py-2 flex flex-wrap items-center justify-between gap-2" role="status">
      <p className="text-xs">
        <span className="text-libero uppercase tracking-widest text-[10px] mr-2">Video challenge</span>
        <span className="text-white">{team} · {call}</span>
        <span className="text-muted"> — under review</span>
      </p>
      {canResolve && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" tone="primary" disabled={live.busy} onClick={() => live.resolveChallenge(pending.id, true, true)}>
            Upheld · point to {pending.challenger === 'us' ? 'us' : 'them'}
          </Button>
          <Button size="sm" tone="neutral" disabled={live.busy} onClick={() => live.resolveChallenge(pending.id, true, false)}>Upheld · replay</Button>
          <Button size="sm" tone="danger" disabled={live.busy} onClick={() => live.resolveChallenge(pending.id, false, false)}>Rejected</Button>
        </div>
      )}
    </div>
  )
}

export default ChallengeBanner
