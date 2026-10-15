import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import type { Team } from '../types'
import PageShell from '../components/PageShell'
import FitList from '../components/ui/FitList'
import Button from '../components/ui/Button'
import { useBreakpoint } from '../hooks/useBreakpoint'

const DashboardPage = () => {
  const navigate = useNavigate()
  const bp = useBreakpoint()
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/teams').then(r => setTeams(r.data)).catch(() => setError('Failed to load teams'))
  }, [])

  return (
    <PageShell maxWidth="max-w-4xl">
      <header className="shrink-0 flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Your teams</h1>
          <p className="text-muted text-sm mt-1">Select a team to manage roster and matches</p>
        </div>
        <Button tone="primary" onClick={() => navigate('/teams/new')}>+ New team</Button>
      </header>

      {error && <p className="shrink-0 text-opp-soft text-sm mb-3">{error}</p>}
      {!teams && !error && <p className="shrink-0 text-muted text-sm">Loading teams…</p>}

      {teams && (
        <FitList
          className="flex-1"
          items={teams}
          rowHeight={88}
          columns={bp === 'phone' ? 1 : 2}
          keyOf={t => t.id}
          empty="No teams yet. Create one, or ask your manager to invite you."
          renderRow={team => (
            <button
              type="button"
              onClick={() => navigate(`/teams/${team.id}`)}
              className="w-full h-20 flex items-center justify-between gap-3 border border-line bg-card rounded px-5 text-left hover:border-us transition-motion-fast group"
            >
              <span className="min-w-0">
                <span className="block text-white font-medium truncate group-hover:text-libero transition-motion-fast">{team.name}</span>
                <span className="block text-muted text-xs mt-1.5">
                  {team._count?.players ?? 0} players · {team.members.length} staff · {team._count?.matches ?? 0} matches
                </span>
              </span>
              <span className="text-muted text-lg group-hover:text-us transition-motion-fast">→</span>
            </button>
          )}
        />
      )}
    </PageShell>
  )
}

export default DashboardPage
