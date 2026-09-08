import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import api from '../lib/api'
import type { Lineup } from '../types'
import PageShell from '../components/PageShell'

interface NationalTeam {
  name: string
  code: string
  flag: string
  confederation: string
}

interface Competitions {
  international: string[]
  club: string[]
  other: string[]
}

const NewMatchPage = () => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [lineups, setLineups] = useState<Lineup[]>([])
  const [teamName, setTeamName] = useState('')
  const [nationalTeams, setNationalTeams] = useState<NationalTeam[]>([])
  const [competitions, setCompetitions] = useState<Competitions>({
    international: [], club: [], other: []
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [opponentInput, setOpponentInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [competition, setCompetition] = useState('Friendly')
  const [customCompetition, setCustomCompetition] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [lineupId, setLineupId] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [teamRes, lineupsRes, teamsRes, compsRes] = await Promise.all([
          api.get(`/teams/${teamId}`),
          api.get(`/teams/${teamId}/lineups`),
          api.get('/reference/teams'),
          api.get('/reference/competitions')
        ])
        setTeamName(teamRes.data.name)
        setLineups(lineupsRes.data)
        setNationalTeams(teamsRes.data)
        setCompetitions(compsRes.data)
        if (lineupsRes.data.length > 0) {
          setLineupId(lineupsRes.data[0].id)
        }
      } catch {
        navigate(`/teams/${teamId}`)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [teamId, navigate])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredTeams = opponentInput.length > 0
    ? nationalTeams.filter(t =>
        t.name.toLowerCase().includes(opponentInput.toLowerCase()) ||
        t.code.toLowerCase().includes(opponentInput.toLowerCase())
      )
    : []

  const handleOpponentSelect = (team: NationalTeam) => {
    setOpponentInput(team.name)
    setShowDropdown(false)
  }

  const allCompetitions = [
    ...competitions.international,
    ...competitions.club,
    ...competitions.other
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!opponentInput.trim()) {
      setError('Opponent name is required')
      return
    }
    if (!lineupId) {
      setError('Please select a lineup')
      return
    }

    const finalCompetition = customCompetition.trim() || competition
    const scheduledAt = scheduledDate
      ? `${scheduledDate}T${scheduledTime || '00:00'}`
      : null

    setSubmitting(true)
    try {
      await api.post(`/teams/${teamId}/matches`, {
        opponentName: opponentInput.trim(),
        competition: finalCompetition,
        scheduledAt,
        lineupId
      })
      navigate(`/teams/${teamId}?tab=matches`)
    } catch {
      setError('Failed to create match')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050d0f] flex items-center justify-center">
        <span className="text-[#4a6b6b] text-sm">Loading...</span>
      </div>
    )
  }

  return (
    <PageShell
      maxWidth="max-w-lg"
      breadcrumbs={[
        { label: 'Your Teams', path: '/dashboard' },
        { label: teamName, path: `/teams/${teamId}?tab=matches` },
        { label: 'New Match' }
      ]}
    >
        <div className="mb-8">
          <h2 className="text-xl font-semibold">Schedule a Match</h2>
          <p className="text-[#4a6b6b] text-sm mt-1">
            Add an upcoming match for your team
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">

          {/* Opponent */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-[#4a6b6b] mb-2">
              Opponent
            </label>
            <div className="relative" ref={dropdownRef}>
              <input
                type="text"
                value={opponentInput}
                onChange={e => {
                  setOpponentInput(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search by country name or code (e.g. Italy, ITA)"
                className="w-full bg-[#0a1a1c] border border-[#0f2d30] text-white placeholder-[#4a6b6b] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#2A835F] transition-colors"
              />
              {showDropdown && filteredTeams.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a1a1c] border border-[#0f2d30] rounded overflow-hidden z-10 max-h-48 overflow-y-auto">
                  {filteredTeams.map(team => (
                    <div
                      key={team.code}
                      onClick={() => handleOpponentSelect(team)}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#0f2d30] transition-colors"
                    >
                      <span className="text-lg">{team.flag}</span>
                      <span className="text-white text-sm">{team.name}</span>
                      <span className="text-[#4a6b6b] text-xs ml-auto">{team.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[#4a6b6b] text-xs mt-1">
              Select a national team or type any club team name
            </p>
          </div>

          {/* Competition */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-[#4a6b6b] mb-2">
              Competition
            </label>

            {['International', 'Club', 'Other'].map((group, i) => {
              const groupKey = group.toLowerCase() as keyof Competitions
              const items = competitions[groupKey]
              if (!items?.length) return null
              return (
                <div key={group} className={i > 0 ? 'mt-3' : ''}>
                  <p className="text-[#4a6b6b] text-xs mb-2">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map(comp => (
                      <button
                        key={comp}
                        type="button"
                        onClick={() => {
                          setCompetition(comp)
                          setCustomCompetition('')
                        }}
                        className={`px-3 py-1 rounded text-xs uppercase tracking-widest transition-colors ${
                          competition === comp && !customCompetition
                            ? 'bg-[#2A835F] text-white'
                            : 'border border-[#0f2d30] text-[#4a6b6b] hover:text-white hover:border-[#2A835F]'
                        }`}
                      >
                        {comp}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}

            <input
              type="text"
              value={customCompetition}
              onChange={e => setCustomCompetition(e.target.value)}
              placeholder="Or type a custom competition..."
              className="w-full mt-3 bg-[#0a1a1c] border border-[#0f2d30] text-white placeholder-[#4a6b6b] rounded px-4 py-3 text-sm focus:outline-none focus:border-[#2A835F] transition-colors"
            />
          </div>

          {/* Date & Time */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-[#4a6b6b] mb-2">
              Date & Time
            </label>
            <div className="flex gap-3">
              <input
                type="date"
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
                className="flex-1 bg-[#0a1a1c] border border-[#0f2d30] text-white rounded px-4 py-3 text-sm focus:outline-none focus:border-[#2A835F] transition-colors [color-scheme:dark]"
              />
              <input
                type="time"
                value={scheduledTime}
                onChange={e => setScheduledTime(e.target.value)}
                className="w-32 bg-[#0a1a1c] border border-[#0f2d30] text-white rounded px-4 py-3 text-sm focus:outline-none focus:border-[#2A835F] transition-colors [color-scheme:dark]"
              />
            </div>
            <p className="text-[#4a6b6b] text-xs mt-1">
              Optional — leave empty if date not confirmed
            </p>
          </div>

          {/* Lineup */}
          <div>
            <label className="block text-xs uppercase tracking-widest text-[#4a6b6b] mb-2">
              Lineup
            </label>
            {lineups.length === 0 ? (
              <div className="border border-[#0f2d30] rounded px-4 py-3">
                <p className="text-[#4a6b6b] text-sm">No lineups yet.</p>
                <button
                  type="button"
                  onClick={() => navigate(`/teams/${teamId}/lineups/new`)}
                  className="text-[#2A835F] text-sm hover:text-[#8BBB92] transition-colors mt-1"
                >
                  Create a lineup first →
                </button>
              </div>
            ) : (
              <select
                value={lineupId}
                onChange={e => setLineupId(e.target.value)}
                className="w-full bg-[#0a1a1c] border border-[#0f2d30] text-white rounded px-4 py-3 text-sm focus:outline-none focus:border-[#2A835F] transition-colors"
              >
                {lineups.map(lineup => (
                  <option key={lineup.id} value={lineup.id}>
                    {lineup.name} · {lineup.rotationSystem}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <p className="text-[#8B1A2C] text-sm">{error}</p>
          )}

          </div>

          <div className="flex gap-3 pt-4 shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/teams/${teamId}?tab=matches`)}
              className="flex-1 border border-[#8B1A2C] text-[#8B1A2C] py-3 rounded text-sm hover:bg-[#8B1A2C] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || lineups.length === 0}
              className="flex-1 bg-[#2A835F] text-white py-3 rounded text-sm font-medium hover:bg-[#235a45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Scheduling...' : 'Schedule Match'}
            </button>
          </div>

        </form>
    </PageShell>
  )
}

export default NewMatchPage