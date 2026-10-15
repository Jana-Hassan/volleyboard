import { useState } from 'react'
import type { ViewProps } from './shared'
import MatchCourt from '../MatchCourt'
import ResourcePanel from '../ResourcePanel'
import RotationEfficiency from '../RotationEfficiency'
import PlayerEfficiencyList from '../PlayerEfficiencyList'
import CoachActions from '../CoachActions'
import MomentumStrip from '../MomentumStrip'
import PointFeed from '../PointFeed'
import SetStrip from '../SetStrip'
import HeadToHead from '../HeadToHead'
import MobileTabBar from '../MobileTabBar'
import type { MobileTab } from '../MobileTabBar'

const CoachView = ({ view, live, bp, canResources, openSheet }: ViewProps) => {
  const [tab, setTab] = useState<MobileTab>('court')
  const set = view.activeSet!
  const actions = canResources && (
    <CoachActions
      size={bp === 'phone' ? 'normal' : 'large'}
      disabled={live.busy}
      onTimeout={() => openSheet({ kind: 'timeout' })}
      onSub={() => openSheet({ kind: 'sub' })}
      onChallenge={() => openSheet({ kind: 'challenge' })}
    />
  )

  if (bp === 'phone') {
    return (
      <>
        <main className="flex-1 min-h-0 flex flex-col gap-3 p-4">
          {tab === 'court' && (
            <>
              <MatchCourt view={view} fit="contain" className="flex-1 min-h-0" />
              <ResourcePanel set={set} variant="strip" />
              {actions}
            </>
          )}
          {tab === 'stats' && (
            <>
              <RotationEfficiency view={view} className="flex-1" />
              <PlayerEfficiencyList view={view} className="flex-1" />
            </>
          )}
          {tab === 'info' && (
            <>
              <SetStrip view={view} />
              <MomentumStrip events={view.events} teamName={view.match.teamName} opponentName={view.match.opponentName} />
              <HeadToHead view={view} />
              <PointFeed view={view} className="flex-1" />
            </>
          )}
        </main>
        <MobileTabBar tabs={['court', 'stats', 'info']} active={tab} onChange={setTab} />
      </>
    )
  }

  return (
    <main className="flex-1 min-h-0 flex flex-col gap-4 p-4 xl:p-6">
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] gap-5 xl:gap-8">
        <div className="min-h-0 flex flex-col">
          <p className="shrink-0 text-[10px] uppercase tracking-widest text-muted mb-2">Court — rotation {set.currentRotation}</p>
          <MatchCourt view={view} className="flex-1 min-h-0" />
        </div>
        <RotationEfficiency view={view} />
        <PlayerEfficiencyList view={view} />
      </div>
      <div className="shrink-0 border-t border-line pt-3">
        <ResourcePanel set={set} variant="strip" />
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </main>
  )
}

export default CoachView
