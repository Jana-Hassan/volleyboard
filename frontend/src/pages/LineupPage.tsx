import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import type { Player, Lineup } from '../types'
import Court from '../components/Court'
import PageShell from '../components/PageShell'
import FitList from '../components/ui/FitList'
import Button from '../components/ui/Button'
import Pill from '../components/ui/Pill'
import { useBreakpoint } from '../hooks/useBreakpoint'

type SlotRole = 'starter' | 'libero' | 'bench' | 'reserved'

interface Assignment {
  playerId: string
  role: SlotRole
  rotationPosition: number | null
}

const ROTATION_SYSTEMS = ['5-1', '6-2', '4-2']
const MAX_LIBEROS = 2

const LineupPage = () => {
  const { teamId, lineupId } = useParams<{ teamId: string; lineupId?: string }>()
  const navigate = useNavigate()
  const isEditing = Boolean(lineupId)
  const bp = useBreakpoint()
  const [tab, setTab] = useState<'court' | 'players'>('court')

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
  const liberos = assignments.filter(a => a.role === 'libero')

  // Lineups saved before the libero rules could have a libero among the six.
  const liberoStarters = starters.filter(a => getPlayer(a.playerId)?.isLibero)
  const liberosOnBench = bench.filter(a => getPlayer(a.playerId)?.isLibero)

  const setterCount = starters.filter(
    a => getPlayer(a.playerId)?.position.toLowerCase() === 'setter'
  ).length
  const requiredSetters = rotationSystem === '5-1' ? 1 : 2

  // The libero is never one of the six starters (FIVB 19); during the match
  // they come on for a back-row player.
  const blockReason = (player: Player): string | null =>
    player.isLibero ? 'A libero is not one of the six starters: give them a libero slot (L)' : null

  // A registered libero plays as libero or sits out; everyone else is bench or reserved.
  const rolesFor = (player: Player): SlotRole[] =>
    player.isLibero ? ['libero', 'reserved'] : ['bench', 'reserved']

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
    if (liberoStarters.length > 0) {
      return setError('A libero cannot be a starter')
    }
    if (liberosOnBench.length > 0) {
      return setError('A libero cannot be a bench substitute')
    }
    if (liberos.length > MAX_LIBEROS) {
      return setError(`At most ${MAX_LIBEROS} liberos (currently ${liberos.length})`)
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
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save lineup')
    } finally {
      setSubmitting(false)
    }
  }

  const formatEditedAt = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) {
    return <div className="h-dvh bg-surface flex items-center justify-center text-muted text-sm">Loading…</div>
  }

  const court = (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <Court
        fit="contain"
        className="flex-1 min-h-0"
        players={starters.map(a => {
          const p = getPlayer(a.playerId)!
          return { playerId: p.id, name: p.name, number: p.number, isLibero: p.isLibero, position: a.rotationPosition! }
        })}
        mode="edit"
        selectedPosition={selectedPosition}
        onPositionClick={position => {
          if (getPlayerAtPosition(position)) clearPosition(position)
          else {
            setSelectedPosition(selectedPosition === position ? null : position)
            if (bp === 'phone') setTab('players')
          }
        }}
      />
      <div className="shrink-0 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
        <span className={starters.length === 6 ? 'text-us' : 'text-muted'}>Starters {starters.length}/6</span>
        <span className={setterCount === requiredSetters ? 'text-us' : 'text-opp-soft'}>Setters {setterCount}/{requiredSetters}</span>
        <span className={liberos.length <= MAX_LIBEROS ? 'text-libero' : 'text-opp-soft'}>Liberos {liberos.length}/{MAX_LIBEROS}</span>
        <span className="text-muted">Bench {bench.length} · Reserved {reserved.length}</span>
      </div>
    </div>
  )

  const roster = (
    <FitList
      className="flex-1"
      items={players}
      rowHeight={bp === 'phone' ? 44 : 30}
      columns={2}
      keyOf={p => p.id}
      empty="No players on this team yet"
      header={
        <p className={`shrink-0 text-[10px] uppercase tracking-widest mb-2 ${selectedPosition ? 'text-opp-soft' : 'text-muted'}`}>
          {selectedPosition ? `Assign to position ${selectedPosition}` : 'Roster · tap a court position to fill it'}
        </p>
      }
      renderRow={player => {
        const assignment = getAssignment(player.id)
        const role = assignment?.role
        const reason = selectedPosition ? blockReason(player) : null
        const canAssign = selectedPosition && !role && !reason
        return (
          <div
            className={`h-full flex items-center gap-1.5 px-1.5 rounded text-[11px] border-b border-line/60 ${role === 'starter' ? 'bg-card' : ''} ${reason ? 'opacity-30' : ''}`}
            title={reason ?? undefined}
          >
            <span className={`w-5 shrink-0 tabular-nums ${player.isLibero ? 'text-libero' : 'text-us'}`}>{player.number}</span>
            <span className="flex-1 min-w-0 truncate text-white">{player.name}</span>
            {canAssign && (
              <button
                type="button"
                onClick={() => { assignToPosition(player.id, selectedPosition!); if (bp === 'phone') setTab('court') }}
                className="text-[9px] uppercase tracking-widest text-opp-soft hover:text-white pointer-coarse:min-h-11 px-1"
              >
                Add
              </button>
            )}
            {!selectedPosition && role !== 'starter' && (
              <div className="flex gap-0.5">
                {rolesFor(player).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => togglePlayerRole(player.id, r)}
                    className={`text-[9px] uppercase w-5 rounded transition-motion-fast pointer-coarse:min-h-11 pointer-coarse:w-8 ${role === r ? 'bg-line text-white' : 'text-muted hover:text-white'}`}
                  >
                    {r[0]}
                  </button>
                ))}
              </div>
            )}
            {role === 'starter' && <span className="text-[9px] text-us w-3 text-right">{assignment?.rotationPosition}</span>}
          </div>
        )
      }}
    />
  )

  return (
    <PageShell
      maxWidth="max-w-6xl"
      breadcrumbs={[
        { label: 'Your Teams', path: '/dashboard' },
        { label: teamName, path: `/teams/${teamId}?tab=lineups` },
        { label: isEditing ? name || 'Lineup' : 'New Lineup' }
      ]}
    >
      <header className="shrink-0 flex flex-wrap items-end gap-x-6 gap-y-3 mb-4">
        <div className="min-w-0 mr-auto">
          <h1 className="text-lg font-semibold">{isEditing ? 'Edit lineup' : 'New lineup'}</h1>
          {lastEdited && (
            <p className="text-muted text-xs mt-0.5">Edited by {lastEdited.name} · {formatEditedAt(lastEdited.at)}</p>
          )}
        </div>
        <label className="w-full sm:w-64">
          <span className="block text-[10px] uppercase tracking-widest text-muted mb-1">Lineup name</span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="vs Italy — VNL 2026"
            className="w-full bg-card border border-line text-white placeholder-muted rounded px-3 py-2 text-sm focus:outline-none focus:border-us transition-motion-fast"
          />
        </label>
        <div>
          <span className="block text-[10px] uppercase tracking-widest text-muted mb-1">Rotation system</span>
          <div className="flex gap-1.5">
            {ROTATION_SYSTEMS.map(sys => (
              <Pill key={sys} selected={rotationSystem === sys} onClick={() => setRotationSystem(sys)}>{sys}</Pill>
            ))}
          </div>
        </div>
      </header>

      {bp === 'phone' ? (
        <>
          <div className="shrink-0 flex gap-2 mb-3">
            <Pill selected={tab === 'court'} onClick={() => setTab('court')}>Court</Pill>
            <Pill selected={tab === 'players'} onClick={() => setTab('players')}>Players</Pill>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">{tab === 'court' ? court : roster}</div>
        </>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6">
          <div className="min-h-0 flex flex-col">{court}</div>
          <div className="min-h-0 flex flex-col">{roster}</div>
        </div>
      )}

      {error && <p className="shrink-0 text-opp-soft text-sm mt-3">{error}</p>}

      <div className="shrink-0 flex justify-end gap-3 pt-4 mt-3 border-t border-line">
        <Button tone="danger" onClick={() => navigate(`/teams/${teamId}?tab=lineups`)}>Cancel</Button>
        <Button tone="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create lineup'}
        </Button>
      </div>
    </PageShell>
  )
}

export default LineupPage