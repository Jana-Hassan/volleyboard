import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSocket } from '../hooks/useSocket'
import api from '../lib/api'
import type { MatchSet, CourtPosition, PlayerStats, MemberRole, Player } from '../types'
import Navbar from '../components/Navbar'
import Court from '../components/Court'
import type { CourtPlayer } from '../components/Court'

type EventType = 'attack' | 'serve' | 'reception' | 'block' | 'dig' | 'set'

const OUTCOMES: Record<EventType, { key: string; label: string; tone: 'good' | 'bad' | 'neutral' }[]> = {
  attack:    [{ key: 'kill', label: 'Kill', tone: 'good' }, { key: 'error', label: 'Error', tone: 'bad' }, { key: 'in_play', label: 'In Play', tone: 'neutral' }, { key: 'blocked', label: 'Blocked', tone: 'neutral' }],
  serve:     [{ key: 'ace', label: 'Ace', tone: 'good' }, { key: 'error', label: 'Error', tone: 'bad' }, { key: 'in_play', label: 'In Play', tone: 'neutral' }],
  reception: [{ key: 'perfect', label: 'Perfect', tone: 'good' }, { key: 'good', label: 'Good', tone: 'neutral' }, { key: 'error', label: 'Error', tone: 'bad' }],
  block:     [{ key: 'kill', label: 'Kill', tone: 'good' }, { key: 'touch', label: 'Touch', tone: 'neutral' }, { key: 'error', label: 'Error', tone: 'bad' }, { key: 'in_play', label: 'In Play', tone: 'neutral' }],
  dig:       [{ key: 'perfect', label: 'Perfect', tone: 'good' }, { key: 'good', label: 'Good', tone: 'neutral' }, { key: 'error', label: 'Error', tone: 'bad' }],
  set:       [{ key: 'perfect', label: 'Perfect', tone: 'good' }, { key: 'good', label: 'Good', tone: 'neutral' }, { key: 'error', label: 'Error', tone: 'bad' }]
}

const EVENT_TYPES: { key: EventType; short: string }[] = [
  { key: 'attack', short: 'ATK' },
  { key: 'serve', short: 'SRV' },
  { key: 'reception', short: 'REC' },
  { key: 'block', short: 'BLK' },
  { key: 'dig', short: 'DIG' },
  { key: 'set', short: 'SET' }
]

interface MatchData {
  matchId: string
  status: 'pending' | 'live' | 'completed'
  opponentName: string
  competition: string
  scheduledAt: string | null
  ourSetsWon: number
  opponentSetsWon: number
  matchOver: boolean
  activeSet: MatchSet | null
  currentPositions: Record<string, CourtPosition> | null
  sets: MatchSet[]
  teamName?: string
  teamId?: string
}

const MatchPage = () => {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { socket, connected } = useSocket(matchId)

  const [match, setMatch] = useState<MatchData | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [role, setRole] = useState<MemberRole | null>(null)
  const [teamName, setTeamName] = useState('')
  const [teamId, setTeamId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const [eventType, setEventType] = useState<EventType>('attack')
  const [codingTeam, setCodingTeam] = useState<'us' | 'opponent'>('us')
  const [lastEvent, setLastEvent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const activeSet = match?.activeSet ?? null
  const positions = match?.currentPositions ?? null

  const loadMatch = useCallback(async () => {
    try {
      const stateRes = await api.get(`/matches/${matchId}/state`)
      const data: MatchData = stateRes.data
      setMatch(data)

      if (data.teamId) {
        setTeamId(data.teamId)
        const [teamRes, playersRes] = await Promise.all([
          api.get(`/teams/${data.teamId}`),
          api.get(`/teams/${data.teamId}/players`)
        ])
        setTeamName(teamRes.data.name)
        setPlayers(playersRes.data)
        const member = teamRes.data.members.find(
          (m: { userId: string }) => m.userId === user?.id
        )
        setRole(member?.role ?? null)
      }

      if (data.activeSet) {
        const statsRes = await api.get(`/sets/${data.activeSet.id}/events/stats`)
        setStats(statsRes.data.players ?? [])
      }
    } catch {
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }, [matchId, navigate, user?.id])

  useEffect(() => { loadMatch() }, [loadMatch])

  useEffect(() => {
    if (!socket) return

    const onScore = () => loadMatch()
    const onStarted = () => loadMatch()
    const onSetFinished = () => loadMatch()
    const onMatchFinished = () => loadMatch()

    socket.on('score_updated', onScore)
    socket.on('match_started', onStarted)
    socket.on('set_finished', onSetFinished)
    socket.on('match_finished', onMatchFinished)
    socket.on('next_set_started', onStarted)

    return () => {
      socket.off('score_updated', onScore)
      socket.off('match_started', onStarted)
      socket.off('set_finished', onSetFinished)
      socket.off('match_finished', onMatchFinished)
      socket.off('next_set_started', onStarted)
    }
  }, [socket, loadMatch])

  const courtPlayers: CourtPlayer[] = positions
    ? Object.values(positions).map(p => ({
        playerId: p.playerId,
        name: p.playerName,
        number: players.find(pl => pl.id === p.playerId)?.number ?? '',
        isLibero: p.isLibero,
        position: p.rotationPosition
      }))
    : []

  const servingPosition = activeSet?.servingTeam === 'us' ? 1 : null

  const canCode = role === 'analyst' || role === 'coach' || role === 'manager'
  const canControl = role === 'coach' || role === 'manager'
  const isCoachView = role === 'coach' || role === 'manager'

  const startMatch = async () => {
    setBusy(true)
    setError('')
    try {
      await api.post(`/teams/${teamId}/matches/${matchId}/start`)
      await loadMatch()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not start match')
    } finally {
      setBusy(false)
    }
  }

  const scorePoint = async (scorer: 'us' | 'opponent') => {
    if (!activeSet) return
    setBusy(true)
    try {
      await api.post(`/teams/${teamId}/matches/sets/${activeSet.id}/point`, { scorer })
      await loadMatch()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not score point')
    } finally {
      setBusy(false)
    }
  }

  const logEvent = async (outcome: string) => {
    if (!activeSet) return
    if (codingTeam === 'us' && !selectedPlayerId) {
      setError('Select a player first')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.post(`/sets/${activeSet.id}/events`, {
        team: codingTeam,
        eventType,
        outcome,
        playerId: codingTeam === 'us' ? selectedPlayerId : undefined
      })
      const player = players.find(p => p.id === selectedPlayerId)
      setLastEvent(
        codingTeam === 'us'
          ? `#${player?.number} ${player?.name} · ${eventType} · ${outcome}`
          : `Opponent · ${eventType} · ${outcome}`
      )
      await loadMatch()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not log event')
    } finally {
      setBusy(false)
    }
  }

  const nextSet = async () => {
    setBusy(true)
    try {
      await api.post(`/teams/${teamId}/matches/${matchId}/next-set`)
      await loadMatch()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not start next set')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050d0f] flex items-center justify-center">
        <span className="text-[#4a6b6b] text-sm">Loading match...</span>
      </div>
    )
  }

  if (!match) return null

  const outcomeStyle = (tone: 'good' | 'bad' | 'neutral') => {
    if (tone === 'good') return 'bg-[#2A835F] text-white hover:bg-[#235a45]'
    if (tone === 'bad') return 'bg-[#8B1A2C] text-white hover:bg-[#6d1423]'
    return 'border border-[#0f2d30] text-white hover:border-[#4a6b6b]'
  }

  return (
    <div className="min-h-screen bg-[#050d0f] text-white">
      <Navbar breadcrumbs={[
        { label: 'Your Teams', path: '/dashboard' },
        { label: teamName, path: `/teams/${teamId}?tab=matches` },
        { label: `vs ${match.opponentName}` }
      ]} />

      {/* SCORE BAND */}
      <div className="border-b border-[#0f2d30] bg-[#0a1a1c]">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">

            <div className="flex-1 text-right pr-8">
              <p className="text-[10px] uppercase tracking-widest text-[#4a6b6b]">
                {teamName}
              </p>
              <p className="text-4xl font-bold tabular-nums leading-none mt-1">
                {activeSet?.ourScore ?? 0}
              </p>
              {activeSet?.servingTeam === 'us' && (
                <p className="text-[10px] uppercase tracking-widest text-[#2A835F] mt-1">
                  ▲ Serving
                </p>
              )}
            </div>

            <div className="text-center px-4">
              <p className="text-[#4a6b6b] text-2xl">—</p>
              <p className="text-[10px] uppercase tracking-widest text-[#4a6b6b] mt-2">
                {match.status === 'live'
                  ? `Set ${activeSet?.setNumber ?? 1}`
                  : match.status === 'completed' ? 'Final' : 'Not started'}
              </p>
            </div>

            <div className="flex-1 pl-8">
              <p className="text-[10px] uppercase tracking-widest text-[#8B1A2C]">
                {match.opponentName}
              </p>
              <p className="text-4xl font-bold tabular-nums leading-none mt-1">
                {activeSet?.opponentScore ?? 0}
              </p>
              {activeSet?.servingTeam === 'opponent' && (
                <p className="text-[10px] uppercase tracking-widest text-[#8B1A2C] mt-1">
                  ▲ Serving
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 ml-8">
              {match.status === 'live' && (
                <span className="flex items-center gap-1.5 text-[#2A835F] text-[10px] uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2A835F] animate-pulse" />
                  Live
                </span>
              )}
              <span className={`text-[10px] uppercase tracking-widest ${connected ? 'text-[#2A835F]' : 'text-[#4a6b6b]'}`}>
                {connected ? 'Synced' : 'Offline'}
              </span>
            </div>
          </div>

          <p className="text-center text-[#4a6b6b] text-xs mt-2">
            Sets: {teamName} {match.ourSetsWon} — {match.opponentSetsWon} {match.opponentName}
            {match.sets.length > 0 && (
              <span className="ml-3">
                {match.sets.filter(s => s.status === 'finished').map(s =>
                  `${s.ourScore}-${s.opponentScore}`
                ).join(' · ')}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5">

        {/* NOT STARTED */}
        {match.status === 'pending' && (
          <div className="border border-[#0f2d30] rounded p-10 text-center">
            <p className="text-white text-sm">Match has not started</p>
            <p className="text-[#4a6b6b] text-xs mt-1">
              {match.competition} · {match.scheduledAt
                ? new Date(match.scheduledAt).toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })
                : 'Date not set'}
            </p>
            {canControl ? (
              <button
                onClick={startMatch}
                disabled={busy}
                className="mt-5 bg-[#2A835F] text-white px-6 py-2.5 rounded text-sm font-medium hover:bg-[#235a45] transition-colors disabled:opacity-50"
              >
                {busy ? 'Starting...' : 'Start Match'}
              </button>
            ) : (
              <p className="text-[#4a6b6b] text-xs mt-5">
                Waiting for the coach to start the match
              </p>
            )}
          </div>
        )}

        {/* COMPLETED */}
        {match.status === 'completed' && (
          <div className="border border-[#0f2d30] rounded p-10 text-center">
            <p className={`text-2xl font-bold ${match.ourSetsWon > match.opponentSetsWon ? 'text-[#2A835F]' : 'text-[#8B1A2C]'}`}>
              {match.ourSetsWon > match.opponentSetsWon ? 'Win' : 'Loss'}
            </p>
            <p className="text-[#4a6b6b] text-sm mt-2">
              {match.ourSetsWon} — {match.opponentSetsWon}
            </p>
          </div>
        )}

        {/* LIVE */}
        {match.status === 'live' && activeSet && (
          <div className="grid gap-4 grid-cols-[400px_1fr]">

            {/* LEFT — court + resources */}
            <div className="space-y-3">
              <Court
                players={courtPlayers}
                mode="live"
                selectedPlayerId={selectedPlayerId}
                servingPosition={servingPosition}
                onPlayerClick={(playerId) =>
                  setSelectedPlayerId(selectedPlayerId === playerId ? null : playerId)
                }
                showRotationLabel={activeSet.currentRotation}
              />

              <div className="space-y-1.5">
                {[
                  { label: 'Substitutions', used: activeSet.subCount, total: 6 },
                  { label: 'Timeouts', used: 2 - activeSet.ourTimeoutsRemaining, total: 2 },
                  { label: 'Challenges', used: 2 - activeSet.ourChallengesRemaining, total: 2 }
                ].map(r => (
                  <div key={r.label}>
                    <div className="flex justify-between text-[9px] uppercase tracking-widest mb-0.5">
                      <span className="text-[#4a6b6b]">{r.label}</span>
                      <span className="text-white">{r.used}/{r.total}</span>
                    </div>
                    <div className="h-1 bg-[#0f2d30] rounded overflow-hidden">
                      <div
                        className="h-full bg-[#2A835F] transition-all duration-300"
                        style={{ width: `${(r.used / r.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {canControl && (
                <div className="grid grid-cols-3 gap-1.5">
                  {['Timeout', 'Sub', 'Challenge'].map(action => (
                    <button
                      key={action}
                      className="border border-[#2A835F] text-[#2A835F] py-1.5 rounded text-[9px] uppercase tracking-widest hover:bg-[#2A835F] hover:text-white transition-colors"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div className="space-y-3">

              {canCode && (
                <div className="border border-[#0f2d30] rounded p-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[9px] uppercase tracking-widest text-[#4a6b6b]">
                      Event Coding
                      {codingTeam === 'us' && selectedPlayerId && (
                        <span className="text-white ml-2">
                          · {players.find(p => p.id === selectedPlayerId)?.name}
                        </span>
                      )}
                      {codingTeam === 'us' && !selectedPlayerId && (
                        <span className="text-[#8B1A2C] ml-2">· select a player on court</span>
                      )}
                    </span>
                    <div className="flex gap-1">
                      {(['us', 'opponent'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => { setCodingTeam(t); setSelectedPlayerId(null) }}
                          className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-widest transition-colors ${
                            codingTeam === t
                              ? t === 'us' ? 'bg-[#2A835F] text-white' : 'bg-[#8B1A2C] text-white'
                              : 'border border-[#0f2d30] text-[#4a6b6b] hover:text-white'
                          }`}
                        >
                          {t === 'us' ? 'Our Team' : 'Opponent'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-1 mb-2.5">
                    {EVENT_TYPES.map(t => (
                      <button
                        key={t.key}
                        onClick={() => setEventType(t.key)}
                        className={`flex-1 py-1.5 rounded text-[9px] uppercase tracking-widest transition-colors ${
                          eventType === t.key
                            ? 'bg-[#0f2d30] text-white'
                            : 'text-[#4a6b6b] hover:text-white'
                        }`}
                      >
                        {t.short}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {OUTCOMES[eventType].map(o => (
                      <button
                        key={o.key}
                        onClick={() => logEvent(o.key)}
                        disabled={busy || (codingTeam === 'us' && !selectedPlayerId)}
                        className={`py-2.5 rounded text-xs font-medium uppercase tracking-wide transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${outcomeStyle(o.tone)}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[9px] text-[#4a6b6b]">
                      {lastEvent ? `Last: ${lastEvent}` : 'No events yet'}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => scorePoint('us')}
                        disabled={busy}
                        className="text-[9px] uppercase tracking-widest text-[#2A835F] hover:text-[#8BBB92] disabled:opacity-50"
                      >
                        +1 us
                      </button>
                      <button
                        onClick={() => scorePoint('opponent')}
                        disabled={busy}
                        className="text-[9px] uppercase tracking-widest text-[#8B1A2C] hover:text-[#b02a3f] disabled:opacity-50"
                      >
                        +1 them
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="border border-[#0f2d30] rounded p-3">
                <p className="text-[9px] uppercase tracking-widest text-[#4a6b6b] mb-2">
                  Live Stats
                </p>
                {stats.length === 0 ? (
                  <p className="text-[#4a6b6b] text-xs">No events coded yet</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-widest text-[#4a6b6b]">
                        <th className="text-left font-normal pb-1.5">Player</th>
                        <th className="text-right font-normal pb-1.5">Atk</th>
                        <th className="text-right font-normal pb-1.5">Srv</th>
                        <th className="text-right font-normal pb-1.5">Rec</th>
                        <th className="text-right font-normal pb-1.5">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map(s => (
                        <tr key={s.playerId} className="border-t border-[#0f2d30]/50">
                          <td className="py-1 text-white truncate max-w-[140px]">{s.playerName}</td>
                          <td className="py-1 text-right text-[#8BBB92]">
                            {s.attack.total ? `${Math.round(s.attack.efficiency * 100)}%` : '—'}
                          </td>
                          <td className="py-1 text-right text-[#8BBB92]">
                            {s.serve.total ? `${Math.round(s.serve.efficiency * 100)}%` : '—'}
                          </td>
                          <td className="py-1 text-right text-[#8BBB92]">
                            {s.reception.total ? `${Math.round(s.reception.efficiency * 100)}%` : '—'}
                          </td>
                          <td className="py-1 text-right text-white font-medium">{s.totalPoints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* set finished, match not over */}
        {match.status === 'live' && !activeSet && canControl && (
          <div className="border border-[#0f2d30] rounded p-8 text-center">
            <p className="text-white text-sm">Set finished</p>
            <button
              onClick={nextSet}
              disabled={busy}
              className="mt-4 bg-[#2A835F] text-white px-6 py-2.5 rounded text-sm font-medium hover:bg-[#235a45] transition-colors disabled:opacity-50"
            >
              {busy ? 'Starting...' : 'Start Next Set'}
            </button>
          </div>
        )}

        {error && <p className="text-[#8B1A2C] text-sm mt-4">{error}</p>}
      </div>
    </div>
  )
}

export default MatchPage