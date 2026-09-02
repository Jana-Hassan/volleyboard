import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../lib/api'
import type { Team } from '../types'
import Navbar from '../components/Navbar'

const DashboardPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await api.get('/teams')
        setTeams(response.data)
      } catch {
        setError('Failed to load teams')
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [])

  return (
    <div className="min-h-screen bg-[#050d0f] text-white">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-semibold text-white">Your Teams</h2>
            <p className="text-[#4a6b6b] text-sm mt-1">
              Select a team to manage roster and matches
            </p>
          </div>
          <button
            onClick={() => navigate('/teams/new')}
            className="bg-[#2A835F] text-white px-4 py-2 rounded text-sm font-medium hover:bg-[#235a45] transition-colors"
          >
            + New Team
          </button>
        </div>

        {loading && (
          <div className="text-[#4a6b6b] text-sm">Loading teams...</div>
        )}

        {error && (
          <div className="text-[#8B1A2C] text-sm">{error}</div>
        )}

        {!loading && teams.length === 0 && (
          <div className="border border-[#0f2d30] rounded p-10 text-center">
            <p className="text-[#4a6b6b] text-sm">No teams yet.</p>
            <p className="text-[#4a6b6b] text-sm mt-1">
              Create a team or ask your manager to invite you.
            </p>
          </div>
        )}

        <div className="grid gap-3">
          {teams.map((team) => (
            <div
              key={team.id}
              onClick={() => navigate(`/teams/${team.id}`)}
              className="border border-[#0f2d30] bg-[#0a1a1c] rounded p-5 cursor-pointer hover:border-[#2A835F] transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium group-hover:text-[#8BBB92] transition-colors">
                    {team.name}
                  </h3>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-[#4a6b6b] text-xs">
                      {team._count?.players ?? 0} players
                    </span>
                    <span className="text-[#4a6b6b] text-xs">
                      {team.members.length} staff
                    </span>
                    <span className="text-[#4a6b6b] text-xs capitalize">
                      {team.members.find(m => m.user.name === user?.name)?.role ?? 'member'}
                    </span>
                  </div>
                </div>
                <span className="text-[#4a6b6b] text-lg group-hover:text-[#2A835F] transition-colors">
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage