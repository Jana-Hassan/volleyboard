import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBreakpoint } from '../hooks/useBreakpoint'
import api from '../lib/api'
import type { Team, Player, Lineup } from '../types'
import PageShell from '../components/PageShell'
import FitList from '../components/ui/FitList'
import Button from '../components/ui/Button'
import Pill from '../components/ui/Pill'
import StaffPanel from '../components/team/StaffPanel'

interface Match {
  id: string
  opponentName: string
  competition: string
  status: 'pending' | 'live' | 'completed'
  scheduledAt: string | null
  startedAt: string | null
  lineup: Lineup | null
  sets: { ourScore: number; opponentScore: number; status: string }[]
}

type Tab = 'roster' | 'matches' | 'lineups' | 'staff'
const TABS: Tab[] = ['roster', 'matches', 'lineups', 'staff']

const COMPETITION_STYLE: Record<string, string> = {
  'VNL': 'text-us border-us',
  'World Championship': 'text-white border-white',
  'Olympics': 'text-white border-white',
  'Olympic Qualifier': 'text-white border-white',
  'Champions League': 'text-libero border-libero',
  'AVC Championship': 'text-libero border-libero',
  'EuroVolley': 'text-libero border-libero'
}

const STATUS_ORDER = { live: 0, pending: 1, completed: 2 }

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Date not set'

const result = (m: Match) => {
  const finished = m.sets.filter(s => s.status === 'finished')
  const us = finished.filter(s => s.ourScore > s.opponentScore).length
  const them = finished.filter(s => s.opponentScore > s.ourScore).length
  return { us, them, won: us > them }
}

const TeamPage = () => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const bp = useBreakpoint()
  const [searchParams, setSearchParams] = useSearchParams()
  const [team, setTeam] = useState<Team | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [lineups, setLineups] = useState<Lineup[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [competition, setCompetition] = useState('All')
  const tabParam = searchParams.get('tab') as Tab | null
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'roster'

  useEffect(() => {
    Promise.all([
      api.get(`/teams/${teamId}`),
      api.get(`/teams/${teamId}/players`),
      api.get(`/teams/${teamId}/lineups`),
      api.get(`/teams/${teamId}/matches`)
    ])
      .then(([t, p, l, m]) => { setTeam(t.data); setPlayers(p.data); setLineups(l.data); setMatches(m.data) })
      .catch(() => navigate('/dashboard'))
  }, [teamId, navigate])

  if (!team) return <div className="h-dvh bg-surface flex items-center justify-center text-muted text-sm">Loading team…</div>

  const role = team.members.find(m => m.userId === user?.id)?.role
  const canSchedule = role === 'manager' || role === 'assistant'
  const canEditLineups = role === 'manager' || role === 'coach'
  const competitions = ['All', ...new Set(matches.map(m => m.competition))]
  const shownMatches = matches
    .filter(m => competition === 'All' || m.competition === competition)
    .sort((a, b) => {
      if (a.status !== b.status) return STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      const ta = new Date(a.scheduledAt ?? a.startedAt ?? 0).getTime()
      const tb = new Date(b.scheduledAt ?? b.startedAt ?? 0).getTime()
      return a.status === 'pending' ? ta - tb : tb - ta
    })
  const rosterColumns = bp === 'laptop' ? 3 : 2

  const openMatch = (m: Match) => navigate(m.status === 'completed' ? `/matches/${m.id}/report` : `/matches/${m.id}`)

  return (
    <PageShell maxWidth="max-w-6xl" breadcrumbs={[{ label: 'Your Teams', path: '/dashboard' }, { label: team.name }]}>
      <header className="shrink-0 mb-4">
        <h1 className="text-xl font-semibold truncate">{team.name}</h1>
        <p className="text-muted text-sm mt-0.5">{players.length} players · {team.members.length} staff</p>
      </header>

      <nav className="shrink-0 flex gap-5 md:gap-6 border-b border-line mb-4">
        {TABS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setSearchParams({ tab: t })}
            className={`pb-2.5 text-xs md:text-sm uppercase tracking-widest transition-motion-fast pointer-coarse:min-h-11 ${tab === t ? 'text-white border-b-2 border-us' : 'text-muted hover:text-white'}`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'roster' && (
        <FitList
          className="flex-1"
          items={players}
          rowHeight={56}
          columns={rosterColumns}
          keyOf={p => p.id}
          empty="No players yet"
          renderRow={p => (
            <button
              type="button"
              onClick={() => navigate(`/teams/${teamId}/players/${p.id}`)}
              className="w-full h-12 flex items-center gap-3 border border-line bg-card rounded px-3 text-left hover:border-us transition-motion-fast group"
            >
              <span className={`font-bold text-sm w-7 shrink-0 tabular-nums ${p.isLibero ? 'text-libero' : 'text-us'}`}>#{p.number}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-white text-sm truncate group-hover:text-libero transition-motion-fast">{p.name}</span>
                <span className="block text-muted text-[10px] uppercase tracking-wider truncate">{p.position}{p.isLibero && p.position?.toLowerCase() !== 'libero' ? ' · Libero' : ''}</span>
              </span>
            </button>
          )}
        />
      )}

      {tab === 'matches' && (
        <>
          <div className="shrink-0 flex flex-wrap items-center gap-2 mb-3">
            {matches.length > 0 && competitions.map(c => (
              <Pill key={c} selected={competition === c} onClick={() => setCompetition(c)}>{c}</Pill>
            ))}
            {canSchedule && (
              <Button tone="primary" className="ml-auto" onClick={() => navigate(`/teams/${teamId}/matches/new`)}>+ New match</Button>
            )}
          </div>
          <FitList
            className="flex-1"
            items={shownMatches}
            rowHeight={64}
            keyOf={m => m.id}
            empty={canSchedule ? 'No matches scheduled yet. Use “New match” to add one.' : 'No matches scheduled yet.'}
            renderRow={m => {
              const r = result(m)
              return (
                <button
                  type="button"
                  onClick={() => openMatch(m)}
                  className="w-full h-14 flex items-center justify-between gap-3 border border-line bg-card rounded px-4 text-left hover:border-us transition-motion-fast group"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-white text-sm font-medium truncate group-hover:text-libero transition-motion-fast">vs {m.opponentName}</span>
                      <span className={`hidden sm:inline text-[10px] border px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${COMPETITION_STYLE[m.competition] ?? 'text-muted border-muted'}`}>{m.competition}</span>
                    </span>
                    <span className="block text-muted text-xs mt-0.5 truncate">{formatDate(m.scheduledAt ?? m.startedAt)} · {m.lineup?.name ?? 'No lineup'}</span>
                  </span>
                  <span className="shrink-0 text-xs uppercase tracking-widest">
                    {m.status === 'live' && <span className="flex items-center gap-1.5 text-us"><span className="w-1.5 h-1.5 rounded-full bg-opp animate-pulse" />Live</span>}
                    {m.status === 'pending' && <span className="text-muted">Scheduled</span>}
                    {m.status === 'completed' && <span className={`text-sm font-bold normal-case ${r.won ? 'text-us' : 'text-opp-soft'}`}>{r.us}–{r.them} {r.won ? 'W' : 'L'}</span>}
                  </span>
                </button>
              )
            }}
          />
        </>
      )}

      {tab === 'lineups' && (
        <>
          {canEditLineups && (
            <div className="shrink-0 flex justify-end mb-3">
              <Button tone="outline" onClick={() => navigate(`/teams/${teamId}/lineups/new`)}>+ New lineup</Button>
            </div>
          )}
          <FitList
            className="flex-1"
            items={lineups}
            rowHeight={64}
            keyOf={l => l.id}
            empty="No lineups yet"
            renderRow={l => (
              <button
                type="button"
                onClick={() => navigate(`/teams/${teamId}/lineups/${l.id}`)}
                className="w-full h-14 flex items-center justify-between border border-line bg-card rounded px-4 text-left hover:border-us transition-motion-fast group"
              >
                <span className="min-w-0">
                  <span className="block text-white text-sm font-medium truncate group-hover:text-libero transition-motion-fast">{l.name}</span>
                  <span className="block text-muted text-xs mt-0.5">{l.rotationSystem} · {l.slots.filter(s => s.role === 'starter').length} starters</span>
                </span>
                <span className="text-muted group-hover:text-us transition-motion-fast">→</span>
              </button>
            )}
          />
        </>
      )}

      {tab === 'staff' && (
        <StaffPanel
          team={team}
          currentUserId={user?.id}
          canManage={role === 'manager'}
          onChange={members => setTeam({ ...team, members })}
        />
      )}
    </PageShell>
  )
}

export default TeamPage
