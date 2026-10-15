import { useState } from 'react'
import type { ViewProps } from './shared'
import MatchCourt from '../MatchCourt'
import ResourcePanel from '../ResourcePanel'
import StatsTable from '../StatsTable'
import MomentumStrip from '../MomentumStrip'
import PointFeed from '../PointFeed'
import SetStrip from '../SetStrip'
import HeadToHead from '../HeadToHead'
import MobileTabBar from '../MobileTabBar'
import type { MobileTab } from '../MobileTabBar'

const ReadOnlyView = ({ view, bp }: ViewProps) => {
  const [tab, setTab] = useState<MobileTab>('court')
  const set = view.activeSet!

  if (bp === 'phone') {
    return (
      <>
        <main className="flex-1 min-h-0 flex flex-col gap-3 p-4">
          {tab === 'court' && (
            <>
              <MatchCourt view={view} fit="contain" className="flex-1 min-h-0" />
              <ResourcePanel set={set} />
            </>
          )}
          {tab === 'stats' && <StatsTable view={view} className="flex-1" />}
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
    <main className="flex-1 min-h-0 grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 p-4 xl:p-6">
      <div className="min-h-0 flex flex-col gap-3">
        <MatchCourt view={view} className="flex-1 min-h-0" />
        <ResourcePanel set={set} variant="strip" />
      </div>
      <div className="min-h-0 flex flex-col gap-4">
        <SetStrip view={view} />
        <MomentumStrip events={view.events} teamName={view.match.teamName} opponentName={view.match.opponentName} />
        <HeadToHead view={view} />
        <PointFeed view={view} className="flex-1" />
      </div>
    </main>
  )
}

export default ReadOnlyView
