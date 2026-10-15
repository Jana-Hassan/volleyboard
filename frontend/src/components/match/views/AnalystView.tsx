import { useState } from 'react'
import type { ViewProps } from './shared'
import MatchCourt from '../MatchCourt'
import BenchList from '../BenchList'
import ResourcePanel from '../ResourcePanel'
import RotationHistory from '../RotationHistory'
import EventCoder from '../EventCoder'
import StatsTable from '../StatsTable'
import MomentumStrip from '../MomentumStrip'
import PointFeed from '../PointFeed'
import SetStrip from '../SetStrip'
import MobileTabBar from '../MobileTabBar'
import type { MobileTab } from '../MobileTabBar'

const AnalystView = ({ view, live, bp, canCode, selectedPlayerId, onSelectPlayer, openSheet }: ViewProps) => {
  const [tab, setTab] = useState<MobileTab>('code')
  const set = view.activeSet!
  const onLibero = canCode ? (liberoId: string) => openSheet({ kind: 'libero', liberoId }) : undefined
  const toggleSelect = (id: string) => onSelectPlayer(selectedPlayerId === id ? null : id)

  if (bp === 'phone') {
    return (
      <>
        <main className="flex-1 min-h-0 flex flex-col gap-3 p-4">
          {tab === 'code' && <EventCoder view={view} live={live} selectedPlayerId={selectedPlayerId} onSelectPlayer={onSelectPlayer} onOpenRoster={() => openSheet({ kind: 'opponentRoster' })} size="large" />}
          {tab === 'court' && (
            <>
              <MatchCourt view={view} fit="contain" selectedPlayerId={selectedPlayerId} onPlayerClick={toggleSelect} className="flex-1 min-h-0" />
              <ResourcePanel set={set} />
            </>
          )}
          {tab === 'stats' && <StatsTable view={view} className="flex-1" />}
          {tab === 'info' && (
            <>
              <SetStrip view={view} />
              <MomentumStrip events={view.events} teamName={view.match.teamName} opponentName={view.match.opponentName} />
              <BenchList view={view} columns={2} onLibero={onLibero} />
              <RotationHistory view={view} />
              <PointFeed view={view} className="flex-1" />
            </>
          )}
        </main>
        <MobileTabBar tabs={['code', 'court', 'stats', 'info']} active={tab} onChange={setTab} />
      </>
    )
  }

  return (
    <main className="flex-1 min-h-0 grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5 p-4 xl:p-5">
      <div className="min-h-0 flex flex-col gap-3">
        <MatchCourt view={view} selectedPlayerId={selectedPlayerId} onPlayerClick={toggleSelect} className="flex-1 min-h-0" />
        <BenchList view={view} columns={2} onLibero={onLibero} />
        <ResourcePanel set={set} />
        <RotationHistory view={view} />
      </div>
      <div className="min-h-0 flex flex-col gap-4">
        <EventCoder view={view} live={live} selectedPlayerId={selectedPlayerId} onSelectPlayer={onSelectPlayer} onOpenRoster={() => openSheet({ kind: 'opponentRoster' })} />
        <StatsTable view={view} className="flex-[3] min-h-0 border-t border-line pt-3" />
        <div className="flex-[2] min-h-0 flex flex-col gap-2 border-t border-line pt-3">
          <MomentumStrip events={view.events} teamName={view.match.teamName} opponentName={view.match.opponentName} />
          <PointFeed view={view} className="flex-1" />
        </div>
      </div>
    </main>
  )
}

export default AnalystView
