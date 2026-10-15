import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMatchLive } from '../hooks/useMatchLive'
import { useBreakpoint } from '../hooks/useBreakpoint'
import MatchTopBar from '../components/match/MatchTopBar'
import type { ViewKind } from '../components/match/MatchTopBar'
import ScoreBand from '../components/match/ScoreBand'
import ChallengeBanner from '../components/match/ChallengeBanner'
import { PreMatch, BetweenSets, MatchFinal } from '../components/match/MatchStates'
import { SubSheet, TimeoutSheet, ChallengeSheet, LiberoSheet, OpponentRosterSheet } from '../components/match/ActionSheets'
import AnalystView from '../components/match/views/AnalystView'
import CoachView from '../components/match/views/CoachView'
import ReadOnlyView from '../components/match/views/ReadOnlyView'
import type { OpenSheet, ViewProps } from '../components/match/views/shared'
import Toast from '../components/ui/Toast'

const defaultViewFor = (role: string): ViewKind =>
  role === 'analyst' ? 'analyst' : role === 'coach' || role === 'manager' ? 'coach' : 'readonly'

const MatchPage = () => {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const live = useMatchLive(matchId)
  const bp = useBreakpoint()
  const [chosenView, setChosenView] = useState<ViewKind | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<OpenSheet | null>(null)
  const { view, loadError } = live

  useEffect(() => {
    if (loadError === 403 || loadError === 404) navigate('/dashboard')
  }, [loadError, navigate])

  if (!view) {
    return (
      <div className="h-dvh bg-surface flex items-center justify-center">
        <span className="text-muted text-sm">{loadError === null ? 'Loading match…' : 'Could not load this match'}</span>
      </div>
    )
  }

  const perms = view.permissions
  const canCode = perms.includes('match.code')
  const canRun = perms.includes('match.run')
  const canResources = perms.includes('match.resources')
  const canSwitch = perms.includes('team.manage')
  const canScout = perms.includes('match.scout')
  const requested = chosenView ?? defaultViewFor(view.role)
  const kind: ViewKind = requested === 'analyst' && !canCode ? 'readonly' : requested
  const playing = view.match.status === 'live' && view.activeSet?.status === 'active'

  const props: ViewProps = {
    view, live, bp, canCode, canResources,
    selectedPlayerId,
    onSelectPlayer: setSelectedPlayerId,
    openSheet: setSheet
  }

  const close = () => setSheet(null)

  return (
    <div className="h-dvh flex flex-col bg-surface text-white overflow-hidden">
      <MatchTopBar view={view} connected={live.connected} viewKind={kind} onViewKind={canSwitch ? setChosenView : undefined} />

      {view.match.status === 'pending' && <PreMatch view={view} live={live} canControl={canRun} onOpenRoster={() => setSheet({ kind: 'opponentRoster' })} />}
      {view.match.status === 'completed' && <MatchFinal view={view} />}
      {view.match.status === 'live' && !playing && <BetweenSets view={view} live={live} canControl={canRun} />}

      {playing && (
        <>
          <ScoreBand view={view} variant={bp === 'phone' ? 'phone' : kind === 'coach' ? 'hero' : 'compact'} />
          <ChallengeBanner view={view} live={live} canResolve={canResources} />
          {kind === 'analyst' && <AnalystView {...props} />}
          {kind === 'coach' && <CoachView {...props} />}
          {kind === 'readonly' && <ReadOnlyView {...props} />}
        </>
      )}

      <Toast message={live.actionError} onDone={live.clearActionError} />

      {playing && sheet?.kind === 'sub' && <SubSheet view={view} live={live} onClose={close} />}
      {playing && sheet?.kind === 'timeout' && <TimeoutSheet view={view} live={live} onClose={close} />}
      {playing && sheet?.kind === 'challenge' && <ChallengeSheet view={view} live={live} onClose={close} />}
      {playing && sheet?.kind === 'libero' && <LiberoSheet view={view} live={live} onClose={close} liberoId={sheet.liberoId} />}
      {sheet?.kind === 'opponentRoster' && <OpponentRosterSheet view={view} live={live} onClose={close} canEdit={canScout} />}
    </div>
  )
}

export default MatchPage
