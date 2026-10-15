import { useState } from 'react'
import type { LiveSnapshot, Team } from '../../lib/match/types'
import type { MatchLive } from '../../hooks/useMatchLive'
import { subOptions, subOutCandidates, liberoTargets } from '../../lib/match/derive'
import { CHALLENGE_TYPES, lastName } from '../../lib/match/labels'
import Sheet from '../ui/Sheet'
import Button from '../ui/Button'
import Pill from '../ui/Pill'

interface SheetProps {
  view: LiveSnapshot
  live: MatchLive
  onClose: () => void
}

const PlayerButton = ({ view, id, selected, onClick }: { view: LiveSnapshot; id: string; selected?: boolean; onClick: () => void }) => {
  const p = view.players.find(pl => pl.id === id)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 h-11 px-3 rounded border text-sm transition-motion-fast ${selected ? 'border-us bg-us text-white' : 'border-line text-white hover:border-muted'}`}
    >
      <span className="text-us font-semibold tabular-nums w-6">{p?.number}</span>
      <span className="truncate">{p ? lastName(p.name) : id}</span>
    </button>
  )
}

export const SubSheet = ({ view, live, onClose }: SheetProps) => {
  const [out, setOut] = useState<string | null>(null)
  const candidates = subOutCandidates(view.court)
  const options = out ? subOptions(out, view.lineup, view.substitutions, view.court) : []

  const confirm = async (playerInId: string) => {
    if (out && await live.substitute([{ playerOutId: out, playerInId }])) onClose()
  }

  return (
    <Sheet title={`Substitution · ${6 - (view.activeSet?.subCount ?? 0)} left this set`} onClose={onClose}>
      <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Player off</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {candidates.map(id => <PlayerButton key={id} view={view} id={id} selected={out === id} onClick={() => setOut(id)} />)}
      </div>
      {out && (
        <>
          <p className="text-[10px] uppercase tracking-widest text-muted mt-4 mb-2">Player on</p>
          {options.length === 0
            ? <p className="text-xs text-opp">No one can come on for this player in this set</p>
            : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {options.map(id => <PlayerButton key={id} view={view} id={id} onClick={() => confirm(id)} />)}
              </div>}
        </>
      )}
    </Sheet>
  )
}

export const TimeoutSheet = ({ view, live, onClose }: SheetProps) => {
  const set = view.activeSet
  const call = async (team: Team) => { if (await live.callTimeout(team)) onClose() }
  return (
    <Sheet title="Time-out" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Button tone="primary" size="lg" disabled={!set || set.ourTimeoutsRemaining === 0 || live.busy} onClick={() => call('us')}>
          {view.match.teamName.split(' ')[0]} · {set?.ourTimeoutsRemaining ?? 0} left
        </Button>
        <Button tone="danger" size="lg" disabled={!set || set.oppTimeoutsRemaining === 0 || live.busy} onClick={() => call('opponent')}>
          {view.match.opponentName} · {set?.oppTimeoutsRemaining ?? 0} left
        </Button>
      </div>
    </Sheet>
  )
}

export const ChallengeSheet = ({ view, live, onClose }: SheetProps) => {
  const [team, setTeam] = useState<Team>('us')
  const set = view.activeSet
  const left = team === 'us' ? set?.ourChallengesRemaining ?? 0 : set?.oppChallengesRemaining ?? 0
  const call = async (callType: string) => { if (await live.callChallenge(team, callType)) onClose() }
  return (
    <Sheet title="Video challenge" onClose={onClose}>
      <div className="flex gap-2 mb-3">
        <Pill selected={team === 'us'} tone="us" onClick={() => setTeam('us')}>{view.match.teamName.split(' ')[0]} · {set?.ourChallengesRemaining ?? 0} left</Pill>
        <Pill selected={team === 'opponent'} tone="opp" onClick={() => setTeam('opponent')}>{view.match.opponentName} · {set?.oppChallengesRemaining ?? 0} left</Pill>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CHALLENGE_TYPES.map(t => (
          <Button key={t.key} tone="neutral" disabled={left === 0 || live.busy} onClick={() => call(t.key)}>{t.label}</Button>
        ))}
      </div>
    </Sheet>
  )
}

export const LiberoSheet = ({ view, live, onClose, liberoId }: SheetProps & { liberoId: string }) => {
  const onCourt = view.court?.libero ?? null
  const libero = view.players.find(p => p.id === liberoId)
  const targets = liberoTargets(view.court, view.activeSet?.servingTeam ?? 'us')
  const run = async (ok: Promise<boolean>) => { if (await ok) onClose() }

  return (
    <Sheet title={`Libero · #${libero?.number} ${libero ? lastName(libero.name) : ''}`} onClose={onClose}>
      {onCourt?.liberoId === liberoId && (
        <Button tone="neutral" size="lg" className="w-full" disabled={live.busy} onClick={() => run(live.changeLibero({ action: 'out' }))}>
          Take off · #{view.players.find(p => p.id === onCourt.replacedPlayerId)?.number} comes back
        </Button>
      )}
      {onCourt && onCourt.liberoId !== liberoId && (
        <Button tone="primary" size="lg" className="w-full" disabled={live.busy} onClick={() => run(live.changeLibero({ action: 'in', liberoId, replacedPlayerId: onCourt.liberoId }))}>
          Swap in for libero #{view.players.find(p => p.id === onCourt.liberoId)?.number}
        </Button>
      )}
      {!onCourt && (
        <>
          <p className="text-[10px] uppercase tracking-widest text-muted mb-2">In for a back-row player</p>
          {targets.length === 0
            ? <p className="text-xs text-muted">No back-row player can be replaced right now</p>
            : <div className="grid grid-cols-3 gap-2">
                {targets.map(id => <PlayerButton key={id} view={view} id={id} onClick={() => run(live.changeLibero({ action: 'in', liberoId, replacedPlayerId: id }))} />)}
              </div>}
        </>
      )}
    </Sheet>
  )
}

export const OpponentRosterSheet = ({ view, live, onClose, canEdit }: SheetProps & { canEdit: boolean }) => {
  const [jersey, setJersey] = useState('')
  const [name, setName] = useState('')
  const add = async () => {
    const n = Number(jersey)
    if (!Number.isInteger(n) || n < 1 || n > 99) return
    if (await live.addOpponentPlayer(n, name.trim())) { setJersey(''); setName('') }
  }
  const input = 'bg-surface border border-line text-white placeholder-muted rounded px-3 py-2 text-sm focus:outline-none focus:border-us pointer-coarse:min-h-11'

  return (
    <Sheet title={`${view.match.opponentName} roster · ${view.opponentPlayers.length} players`} onClose={onClose} width="md:max-w-lg">
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mb-3">
        {view.opponentPlayers.map(p => (
          <div key={p.id} className="h-11 flex items-center justify-between gap-1 px-2 rounded border border-line text-xs">
            <span className="min-w-0">
              <span className="text-opp-soft font-semibold tabular-nums">#{p.jersey}</span>
              {p.name && <span className="block text-[9px] text-muted truncate">{p.name}</span>}
            </span>
            {canEdit && (
              <button type="button" aria-label={`Remove #${p.jersey}`} onClick={() => live.removeOpponentPlayer(p.id)} className="text-muted hover:text-white px-1">×</button>
            )}
          </div>
        ))}
        {view.opponentPlayers.length === 0 && <p className="col-span-full text-xs text-muted">No opponent players yet. Add jersey numbers to code their actions by player.</p>}
      </div>
      {canEdit && (
        <form onSubmit={e => { e.preventDefault(); void add() }} className="flex gap-2">
          <input className={`${input} w-20`} inputMode="numeric" placeholder="#" value={jersey} onChange={e => setJersey(e.target.value.replace(/\D/g, '').slice(0, 2))} />
          <input className={`${input} flex-1 min-w-0`} placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} />
          <Button tone="primary" type="submit" disabled={live.busy || !jersey}>Add</Button>
        </form>
      )}
    </Sheet>
  )
}
