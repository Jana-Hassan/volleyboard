import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import type { Player, Lineup } from '../types'
import Navbar from '../components/Navbar'
import Court from '../components/Court'

type SlotRole = 'starter' | 'bench' | 'reserved'

interface Assignment {
  playerId: string
  role: SlotRole
  rotationPosition: number | null
}

const ROTATION_SYSTEMS = ['5-1', '6-2', '4-2']
const LIBERO_ALLOWED_POSITIONS = [5, 6]

const LineupPage = () => {
  const { teamId, lineupId } = useParams<{ teamId: string; lineupId?: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(lineupId)

  const [players, setPlayers] = useState<Player[]>([])
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [rotationSystem, setRotationSystem] = useState('5-1')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null)
  const [lastEdited, setLastEdited] = useState<{ name: string; at: string } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const requests = [
          api.get(`/teams/${teamId}`),
          api.get(`/teams/${teamId}/players`)
        ]
        if (lineupId) requests.push(api.get(`/teams/${teamId}/lineups/${lineupId}`))

        const responses = await Promise.all(requests)
        setTeamName(responses[0].data.name)
        setPlayers(responses[1].data)

        if (lineupId && responses[2]) {
          const lineup: Lineup & {
            lastEditedBy?: { name: string } | null
            updatedAt: string
          } = responses[2].data

          setName(lineup.name)
          setRotationSystem(lineup.rotationSystem)
          setAssignments(
            lineup.slots.map(s => ({
              playerId: s.playerId,
              role: s.role as SlotRole,
              rotationPosition: s.rotationPosition
            }))
          )
          if (lineup.lastEditedBy) {
            setLastEdited({ name: lineup.lastEditedBy.name, at: lineup.updatedAt })
          }
        }
      } catch {
        navigate(`/teams/${teamId}?tab=lineups`)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [teamId, lineupId, navigate])

  const getPlayer = (playerId: string) => players.find(p => p.id === playerId)

  const getPlayerAtPosition = (position: number) => {
    const a = assignments.find(x => x.role === 'starter' && x.rotationPosition === position)
    return a ? getPlayer(a.playerId) : undefined
  }

  const getAssignment = (playerId: string) => assignments.find(a => a.playerId === playerId)

  const starters = assignments.filter(a => a.role === 'starter')
  const bench = assignments.filter(a => a.role === 'bench')
  const reserved = assignments.filter(a => a.role === 'reserved')

  const liberoOnCourt = starters.find(a => getPlayer(a.playerId)?.isLibero)

  const setterCount = starters.filter(
    a => getPlayer(a.playerId)?.position.toLowerCase() === 'setter'
  ).length
  const requiredSetters = rotationSystem === '5-1' ? 1 : 2

  const blockReason = (player: Player, position: number): string | null => {
    if (player.isLibero) {
      if (liberoOnCourt && liberoOnCourt.playerId !== player.id) {
        return 'Only one libero on court'
      }
      if (!LIBERO_ALLOWED_POSITIONS.includes(position)) {
        return position === 1
          ? 'Libero cannot serve'
          : 'Libero cannot play front row'
      }
    }
    return null
  }

  const assignToPosition = (playerId: string, position: number) => {
    setAssignments(prev => {
      const withoutPlayer = prev.filter(a => a.playerId !== playerId)
      const withoutPosition = withoutPlayer.filter(
        a => !(a.role === 'starter' && a.rotationPosition === position)
      )
      return [...withoutPosition, { playerId, role: 'starter', rotationPosition: position }]
    })
    setSelectedPosition(null)
    setError('')
  }

  const togglePlayerRole = (playerId: string, role: SlotRole) => {
    setAssignments(prev => {
      const current = prev.find(a => a.playerId === playerId)
      const withoutPlayer = prev.filter(a => a.playerId !== playerId)
      if (current?.role === role) return withoutPlayer
      return [...withoutPlayer, { playerId, role, rotationPosition: null }]
    })
  }

  const clearPosition = (position: number) => {
    setAssignments(prev =>
      prev.filter(a => !(a.role === 'starter' && a.rotationPosition === position))
    )
  }

  const handleSubmit = async () => {
    setError('')

    if (!name.trim()) return setError('Lineup name is required')
    if (starters.length !== 6) {
      return setError(`Assign exactly 6 starters (currently ${starters.length})`)
    }
    if (setterCount !== requiredSetters) {
      return setError(
        `${rotationSystem} requires exactly ${requiredSetters} setter${requiredSetters > 1 ? 's' : ''} on court (currently ${setterCount})`
      )
    }

    setSubmitting(true)
    try {
      const payload = { name: name.trim(), rotationSystem, slots: assignments }
      if (isEditing) {
        await api.put(`/teams/${teamId}/lineups/${lineupId}`, payload)
      } else {
        await api.post(`/teams/${teamId}/lineups`, payload)
      }
      navigate(`/teams/${teamId}?tab=lineups`)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to save lineup')
    } finally {
      setSubmitting(false)
    }
  }

  const formatEditedAt = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })

  const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050d0f] flex items-center justify-center">
        <span className="text-[#4a6b6b] text-sm">Loading...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050d0f] text-white">
      <Navbar breadcrumbs={[
        { label: 'Your Teams', path: '/dashboard' },
        { label: teamName, path: `/teams/${teamId}?tab=lineups` },
        { label: isEditing ? name || 'Lineup' : 'New Lineup' }
      ]} />

      <div className="max-w-5xl mx-auto px-6 py-6">

        <div className="mb-5">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Lineup' : 'New Lineup'}
          </h2>
          {lastEdited && (
            <p
              className="text-[#4a6b6b] text-xs mt-0.5 cursor-help inline-block"
              title={`Edited by ${lastEdited.name} · ${formatEditedAt(lastEdited.at)}`}
            >
              Edited {timeAgo(lastEdited.at)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5 max-w-xl">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#4a6b6b] mb-1.5">
              Lineup Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="vs Italy — VNL 2026"
              className="w-full bg-[#0a1a1c] border border-[#0f2d30] text-white placeholder-[#4a6b6b] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#2A835F] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#4a6b6b] mb-1.5">
              Rotation System
            </label>
            <div className="flex gap-1.5">
              {ROTATION_SYSTEMS.map(sys => (
                <button
                  key={sys}
                  type="button"
                  onClick={() => setRotationSystem(sys)}
                  className={`flex-1 py-2 rounded text-xs transition-colors ${
                    rotationSystem === sys
                      ? 'bg-[#2A835F] text-white'
                      : 'border border-[#0f2d30] text-[#4a6b6b] hover:text-white hover:border-[#2A835F]'
                  }`}
                >
                  {sys}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_380px] gap-6">

          {/* COURT */}
          <div>
            <Court
              players={starters.map(a => {
                const p = getPlayer(a.playerId)!
                return {
                  playerId: p.id,
                  name: p.name,
                  number: p.number,
                  isLibero: p.isLibero,
                  position: a.rotationPosition!
                }
              })}
              mode="edit"
              selectedPosition={selectedPosition}
              onPositionClick={(position) => {
                const player = getPlayerAtPosition(position)
                if (player) {
                  clearPosition(position)
                } else {
                  setSelectedPosition(selectedPosition === position ? null : position)
                }
              }}
            />

            <div className="flex gap-5 mt-3 text-[11px]">
              <span className={starters.length === 6 ? 'text-[#2A835F]' : 'text-[#4a6b6b]'}>
                Starters {starters.length}/6
              </span>
              <span className={setterCount === requiredSetters ? 'text-[#2A835F]' : 'text-[#8B1A2C]'}>
                Setters {setterCount}/{requiredSetters}
              </span>
              <span className="text-[#8BBB92]">
                Libero {liberoOnCourt ? 1 : 0}/1
              </span>
            </div>
          </div>

          {/* ROSTER — two columns */}
          <div>
            <p className={`text-[10px] uppercase tracking-widest mb-2 ${selectedPosition ? 'text-[#8B1A2C]' : 'text-[#4a6b6b]'}`}>
              {selectedPosition ? `Assign to position ${selectedPosition}` : 'Roster'}
            </p>

            <div className="grid grid-cols-2 gap-x-3 gap-y-px">
              {players.map(player => {
                const assignment = getAssignment(player.id)
                const role = assignment?.role
                const reason = selectedPosition ? blockReason(player, selectedPosition) : null
                const canAssign = selectedPosition && !role && !reason

                return (
                  <div
                    key={player.id}
                    className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[11px] ${
                      role === 'starter' ? 'bg-[#0a1a1c]' : ''
                    } ${reason ? 'opacity-30' : ''}`}
                    title={reason ?? undefined}
                  >
                    <span className={`w-5 shrink-0 font-mono ${player.isLibero ? 'text-[#8BBB92]' : 'text-[#2A835F]'}`}>
                      {player.number}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-white/90">
                      {player.name}
                    </span>

                    {canAssign && (
                      <button
                        type="button"
                        onClick={() => assignToPosition(player.id, selectedPosition!)}
                        className="text-[9px] uppercase tracking-widest text-[#8B1A2C] hover:text-[#b02a3f]"
                      >
                        Add
                      </button>
                    )}

                    {!selectedPosition && role !== 'starter' && (
                      <div className="flex gap-0.5">
                        {(['bench', 'reserved'] as const).map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => togglePlayerRole(player.id, r)}
                            className={`text-[9px] uppercase w-4 rounded transition-colors ${
                              role === r ? 'bg-[#0f2d30] text-white' : 'text-[#4a6b6b] hover:text-white'
                            }`}
                          >
                            {r[0]}
                          </button>
                        ))}
                      </div>
                    )}

                    {role === 'starter' && (
                      <span className="text-[9px] text-[#2A835F] w-3 text-right">
                        {assignment?.rotationPosition}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="mt-3 pt-2 border-t border-[#0f2d30] text-[10px] text-[#4a6b6b]">
              Bench {bench.length} · Reserved {reserved.length}
            </p>
          </div>
        </div>

        {error && <p className="text-[#8B1A2C] text-sm mt-3">{error}</p>}

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={() => navigate(`/teams/${teamId}?tab=lineups`)}
            className="px-6 border border-[#8B1A2C] text-[#8B1A2C] py-2 rounded text-sm hover:bg-[#8B1A2C] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 bg-[#2A835F] text-white py-2 rounded text-sm font-medium hover:bg-[#235a45] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Lineup'}
          </button>
        </div>

      </div>
    </div>
  )
}

export default LineupPage