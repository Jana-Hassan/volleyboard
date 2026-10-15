import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../lib/api'
import PageShell from '../components/PageShell'
import FitList from '../components/ui/FitList'
import Pill from '../components/ui/Pill'
import { useBreakpoint } from '../hooks/useBreakpoint'
import type { Player, PlayerStats } from '../types'

type Line = Omit<PlayerStats, 'playerId' | 'playerName'>

interface Profile {
  player: Player
  totals: Line & { matches: number }
  matches: {
    matchId: string
    opponentName: string
    competition: string
    date: string | null
    status: string
    role: string | null
    ourSetsWon: number
    opponentSetsWon: number
    stats: Line
  }[]
  upcoming: { matchId: string; opponentName: string; competition: string; scheduledAt: string | null; role: string | null }[]
}

const pct = (total: number, value: number) => (total ? `${Math.round(value * 100)}%` : '—')
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set')

const Tile = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-card border border-line rounded px-3 py-2.5">
    <p className="text-[9px] uppercase tracking-widest text-muted">{label}</p>
    <p className="text-xl font-semibold tabular-nums mt-0.5">{value}</p>
  </div>
)

const PlayerProfilePage = () => {
  const { teamId, playerId } = useParams<{ teamId: string; playerId: string }>()
  const navigate = useNavigate()
  const bp = useBreakpoint()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [teamName, setTeamName] = useState('')
  const [tab, setTab] = useState<'overview' | 'matches' | 'upcoming'>('overview')

  useEffect(() => {
    Promise.all([api.get(`/teams/${teamId}/players/${playerId}`), api.get(`/teams/${teamId}`)])
      .then(([p, t]) => { setProfile(p.data); setTeamName(t.data.name) })
      .catch(() => navigate(`/teams/${teamId}`))
  }, [teamId, playerId, navigate])

  if (!profile) {
    return <div className="h-dvh bg-surface flex items-center justify-center text-muted text-sm">Loading player…</div>
  }

  const { player, totals } = profile

  const overview = (
    <section className="flex flex-col gap-3 min-h-0">
      <p className="text-[10px] uppercase tracking-widest text-muted">Season totals · {totals.matches} {totals.matches === 1 ? 'match' : 'matches'}</p>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Points" value={totals.totalPoints} />
        <Tile label="Kills" value={totals.attack.kills} />
        <Tile label="Attack eff." value={pct(totals.attack.total, totals.attack.efficiency)} />
        <Tile label="Aces" value={totals.serve.aces} />
        <Tile label="Serve eff." value={pct(totals.serve.total, totals.serve.efficiency)} />
        <Tile label="Reception eff." value={pct(totals.reception.total, totals.reception.efficiency)} />
        <Tile label="Blocks" value={totals.block.kills} />
        <Tile label="Digs" value={totals.dig.total} />
      </div>
    </section>
  )

  const matchLog = (
    <FitList
      className="flex-1"
      items={profile.matches}
      rowHeight={40}
      keyOf={m => m.matchId}
      empty="No matches played yet"
      header={
        <div className="shrink-0">
          <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Match by match</p>
          <div className="grid grid-cols-[1fr_3.5rem_2.5rem_3rem_3rem_3rem] gap-2 text-[9px] uppercase tracking-widest text-muted pb-1 border-b border-line">
            <span>Match</span><span>Result</span><span className="text-right">Pts</span><span className="text-right">Atk</span><span className="text-right">Srv</span><span className="text-right">Rec</span>
          </div>
        </div>
      }
      renderRow={m => {
        const won = m.ourSetsWon > m.opponentSetsWon
        return (
          <button
            type="button"
            onClick={() => navigate(m.status === 'completed' ? `/matches/${m.matchId}/report` : `/matches/${m.matchId}`)}
            className="w-full h-full grid grid-cols-[1fr_3.5rem_2.5rem_3rem_3rem_3rem] gap-2 items-center text-xs text-left border-b border-line/60 hover:bg-card transition-motion-fast"
          >
            <span className="min-w-0">
              <span className="block truncate text-white">vs {m.opponentName}</span>
              <span className="block truncate text-[10px] text-muted">{day(m.date)} · {m.competition}</span>
            </span>
            <span className={`tabular-nums ${m.status === 'live' ? 'text-us' : won ? 'text-us' : 'text-opp'}`}>
              {m.status === 'live' ? 'Live' : `${won ? 'W' : 'L'} ${m.ourSetsWon}–${m.opponentSetsWon}`}
            </span>
            <span className="text-right tabular-nums text-white">{m.stats.totalPoints}</span>
            <span className="text-right tabular-nums text-libero">{pct(m.stats.attack.total, m.stats.attack.efficiency)}</span>
            <span className="text-right tabular-nums text-libero">{pct(m.stats.serve.total, m.stats.serve.efficiency)}</span>
            <span className="text-right tabular-nums text-libero">{pct(m.stats.reception.total, m.stats.reception.efficiency)}</span>
          </button>
        )
      }}
    />
  )

  const upcoming = (
    <FitList
      className="flex-1"
      items={profile.upcoming}
      rowHeight={44}
      keyOf={u => u.matchId}
      empty="No upcoming matches"
      header={<p className="shrink-0 text-[10px] uppercase tracking-widest text-muted mb-2">Upcoming</p>}
      renderRow={u => (
        <button
          type="button"
          onClick={() => navigate(`/matches/${u.matchId}`)}
          className="w-full h-full flex items-center justify-between gap-2 text-xs border-b border-line/60 hover:bg-card transition-motion-fast text-left"
        >
          <span className="min-w-0">
            <span className="block truncate text-white">vs {u.opponentName}</span>
            <span className="block truncate text-[10px] text-muted">{day(u.scheduledAt)} · {u.competition}</span>
          </span>
          <span className="text-[9px] uppercase tracking-widest text-us shrink-0">{u.role}</span>
        </button>
      )}
    />
  )

  return (
    <PageShell
      maxWidth="max-w-6xl"
      breadcrumbs={[
        { label: 'Your Teams', path: '/dashboard' },
        { label: teamName, path: `/teams/${teamId}?tab=roster` },
        { label: player.name }
      ]}
    >
      <header className="shrink-0 flex items-center gap-4 mb-5">
        <span className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-xl font-bold ${player.isLibero ? 'border-libero' : 'border-us'}`}>
          {player.number}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">{player.name}</h1>
          <p className="text-xs uppercase tracking-widest text-muted">
            {player.position}{player.isLibero && <span className="text-libero"> · Libero</span>}{!player.isActive && ' · Inactive'}
          </p>
        </div>
      </header>

      {bp === 'phone' ? (
        <>
          <div className="shrink-0 flex gap-2 mb-4">
            <Pill selected={tab === 'overview'} onClick={() => setTab('overview')}>Overview</Pill>
            <Pill selected={tab === 'matches'} onClick={() => setTab('matches')}>Matches</Pill>
            <Pill selected={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming</Pill>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            {tab === 'overview' && overview}
            {tab === 'matches' && matchLog}
            {tab === 'upcoming' && upcoming}
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:grid-cols-[minmax(0,3fr)_minmax(0,6fr)_minmax(0,3fr)] gap-6">
          <div className="min-h-0 flex flex-col gap-6">
            {overview}
            <div className="lg:hidden flex-1 min-h-0 flex flex-col">{upcoming}</div>
          </div>
          <div className="min-h-0 flex flex-col">{matchLog}</div>
          <div className="hidden lg:flex min-h-0 flex-col">{upcoming}</div>
        </div>
      )}
    </PageShell>
  )
}

export default PlayerProfilePage
