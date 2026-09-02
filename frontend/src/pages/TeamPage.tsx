import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import type { Team, Player, Lineup } from '../types'
import Navbar from '../components/Navbar'

interface Match {
  id: string
  opponentName: string
  competition: string
  status: 'pending' | 'live' | 'completed'
  scheduledAt: string | null
  startedAt: string | null
  endedAt: string | null
  lineupId: string
  lineup: Lineup
  sets: {
    ourScore: number
    opponentScore: number
    status: string
  }[]
}

const TeamPage = () => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()

  const [team, setTeam] = useState<Team | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [lineups, setLineups] = useState<Lineup[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'roster' | 'matches' | 'lineups' | 'staff'>('roster')
  const [competitionFilter, setCompetitionFilter] = useState('All')

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [teamRes, playersRes, lineupsRes, matchesRes] = await Promise.all([
          api.get(`/teams/${teamId}`),
          api.get(`/teams/${teamId}/players`),
          api.get(`/teams/${teamId}/lineups`),
          api.get(`/teams/${teamId}/matches`)
        ])
        setTeam(teamRes.data)
        setPlayers(playersRes.data)
        setLineups(lineupsRes.data)
        setMatches(matchesRes.data)
      } catch {
        navigate('/dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [teamId, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050d0f] flex items-center justify-center">
        <span className="text-[#4a6b6b] text-sm">Loading...</span>
      </div>
    )
  }

  if (!team) return null

  const tabs = ['roster', 'matches', 'lineups', 'staff'] as const

  const getMatchResult = (match: Match) => {
    if (match.status !== 'completed' || !match.sets.length) return null
    const ourSets = match.sets.filter(s => s.ourScore > s.opponentScore).length
    const oppSets = match.sets.filter(s => s.opponentScore > s.ourScore).length
    return { ourSets, oppSets, won: ourSets > oppSets }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Date not set'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-[#050d0f] text-white">
      <Navbar breadcrumbs={[
        { label: 'Your Teams', path: '/dashboard' },
        { label: team.name }
      ]} />

      <div className="max-w-4xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold">{team.name}</h2>
            <p className="text-[#4a6b6b] text-sm mt-1">
              {players.length} players · {team.members.length} staff
            </p>
          </div>
          <button
            onClick={() => navigate(`/teams/${teamId}/matches/new`)}
            className="bg-[#2A835F] text-white px-4 py-2 rounded text-sm font-medium hover:bg-[#235a45] transition-colors"
          >
            + New Match
          </button>
        </div>

        <div className="flex gap-6 border-b border-[#0f2d30] mb-6">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm uppercase tracking-widest transition-colors ${
                activeTab === tab
                  ? 'text-white border-b-2 border-[#2A835F]'
                  : 'text-[#4a6b6b] hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ROSTER TAB */}
        {activeTab === 'roster' && (
          <div className="grid grid-cols-2 gap-2">
            {players.map(player => (
              <div
                key={player.id}
                className="flex items-center gap-3 border border-[#0f2d30] bg-[#0a1a1c] rounded px-4 py-3"
              >
                <span className="text-[#2A835F] font-bold text-sm w-6 shrink-0">
                  #{player.number}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-white text-sm font-medium truncate block">
                    {player.name}
                  </span>
                  <span className="text-[#4a6b6b] text-xs uppercase tracking-wider">
                    {player.position}{player.isLibero ? ' · L' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MATCHES TAB */}
        {activeTab === 'matches' && (
          <div>
            {matches.length > 0 && (
              <div className="flex gap-2 mb-6 flex-wrap">
                {['All', ...Array.from(new Set(matches.map(m => m.competition)))].map(comp => (
                  <button
                    key={comp}
                    onClick={() => setCompetitionFilter(comp)}
                    className={`px-3 py-1 rounded text-xs uppercase tracking-widest transition-colors ${
                      competitionFilter === comp
                        ? 'bg-[#2A835F] text-white'
                        : 'border border-[#0f2d30] text-[#4a6b6b] hover:text-white hover:border-[#2A835F]'
                    }`}
                  >
                    {comp}
                  </button>
                ))}
              </div>
            )}

            {matches.length === 0 ? (
              <div className="border border-[#0f2d30] rounded p-10 text-center">
                <p className="text-[#4a6b6b] text-sm">No matches yet.</p>
                <button
                  onClick={() => navigate(`/teams/${teamId}/matches/new`)}
                  className="mt-4 text-[#2A835F] text-sm hover:text-[#8BBB92] transition-colors"
                >
                  Schedule your first match →
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {(['live', 'pending', 'completed'] as const).map(status => {
                  const filtered = matches.filter(m =>
                    m.status === status &&
                    (competitionFilter === 'All' || m.competition === competitionFilter)
                  )
                  if (filtered.length === 0) return null

                  const sectionLabel = {
                    live: '● Live Now',
                    pending: 'Upcoming',
                    completed: 'Completed'
                  }[status]

                  return (
                    <div key={status}>
                      <p className={`text-xs uppercase tracking-widest mb-3 ${
                        status === 'live' ? 'text-[#2A835F]' : 'text-[#4a6b6b]'
                      }`}>
                        {sectionLabel}
                      </p>
                      <div className="space-y-2">
                        {filtered.map(match => {
                          const result = getMatchResult(match)
                          return (
                            <div
                              key={match.id}
                              onClick={() => navigate(`/matches/${match.id}`)}
                              className="flex items-center justify-between border border-[#0f2d30] bg-[#0a1a1c] rounded px-5 py-4 cursor-pointer hover:border-[#2A835F] transition-colors group"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-white text-sm font-medium group-hover:text-[#8BBB92] transition-colors">
                                    vs {match.opponentName}
                                  </p>
                                  <span className="text-xs text-[#4a6b6b] border border-[#0f2d30] px-2 py-0.5 rounded uppercase tracking-wider">
                                    {match.competition}
                                  </span>
                                </div>
                                <p className="text-[#4a6b6b] text-xs mt-1">
                                  {match.scheduledAt
                                    ? formatDate(match.scheduledAt)
                                    : match.startedAt
                                      ? formatDate(match.startedAt)
                                      : 'Date not set'
                                  } · {match.lineup?.name ?? 'No lineup'}
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                {match.status === 'live' && (
                                  <span className="flex items-center gap-1.5 text-[#2A835F] text-xs uppercase tracking-widest">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#2A835F] animate-pulse" />
                                    Live
                                  </span>
                                )}
                                {match.status === 'completed' && result && (
                                  <span className={`text-sm font-bold ${result.won ? 'text-[#2A835F]' : 'text-[#8B1A2C]'}`}>
                                    {result.ourSets} – {result.oppSets}
                                    <span className="text-xs font-normal text-[#4a6b6b] ml-1">
                                      {result.won ? 'W' : 'L'}
                                    </span>
                                  </span>
                                )}
                                {match.status === 'pending' && (
                                  <span className="text-[#4a6b6b] text-xs uppercase tracking-widest">
                                    Scheduled
                                  </span>
                                )}
                                <span className="text-[#4a6b6b] group-hover:text-[#2A835F] transition-colors">→</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* LINEUPS TAB */}
        {activeTab === 'lineups' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => navigate(`/teams/${teamId}/lineups/new`)}
                className="border border-[#2A835F] text-[#2A835F] px-4 py-2 rounded text-sm hover:bg-[#2A835F] hover:text-white transition-colors"
              >
                + New Lineup
              </button>
            </div>
            {lineups.length === 0 ? (
              <div className="border border-[#0f2d30] rounded p-10 text-center">
                <p className="text-[#4a6b6b] text-sm">No lineups yet.</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {lineups.map(lineup => (
                  <div
                    key={lineup.id}
                    onClick={() => navigate(`/teams/${teamId}/lineups/${lineup.id}`)}
                    className="flex items-center justify-between border border-[#0f2d30] bg-[#0a1a1c] rounded px-5 py-4 cursor-pointer hover:border-[#2A835F] transition-colors group"
                  >
                    <div>
                      <p className="text-white text-sm font-medium group-hover:text-[#8BBB92] transition-colors">
                        {lineup.name}
                      </p>
                      <p className="text-[#4a6b6b] text-xs mt-1">
                        {lineup.rotationSystem} · {lineup.slots.filter(s => s.role === 'starter').length} starters
                      </p>
                    </div>
                    <span className="text-[#4a6b6b] group-hover:text-[#2A835F] transition-colors">→</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STAFF TAB */}
        {activeTab === 'staff' && (
          <div className="grid gap-2">
            {team.members.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between border border-[#0f2d30] bg-[#0a1a1c] rounded px-5 py-3"
              >
                <div>
                  <p className="text-white text-sm font-medium">{member.user.name}</p>
                  <p className="text-[#4a6b6b] text-xs mt-0.5">{member.user.email}</p>
                </div>
                <span className="text-xs uppercase tracking-widest text-[#2A835F]">
                  {member.role}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

export default TeamPage