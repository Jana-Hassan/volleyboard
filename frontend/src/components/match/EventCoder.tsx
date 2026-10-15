import { useState } from 'react'
import type { LiveSnapshot } from '../../lib/match/types'
import type { MatchLive } from '../../hooks/useMatchLive'
import { EVENT_TYPES, OUTCOMES, eventLabel, lastName } from '../../lib/match/labels'
import type { EventType } from '../../lib/match/labels'
import Pill from '../ui/Pill'

interface EventCoderProps {
  view: LiveSnapshot
  live: MatchLive
  selectedPlayerId: string | null
  onSelectPlayer: (playerId: string | null) => void
  onOpenRoster?: () => void
  size?: 'normal' | 'large'
}

const OUTCOME_STYLE = {
  good: 'bg-us text-white hover:bg-us-hover border-us',
  bad: 'bg-opp text-white hover:bg-opp-hover border-opp',
  neutral: 'border-line text-white hover:border-muted'
}

const EventCoder = ({ view, live, selectedPlayerId, onSelectPlayer, onOpenRoster, size = 'normal' }: EventCoderProps) => {
  const [team, setTeam] = useState<'us' | 'opponent'>('us')
  const [eventType, setEventType] = useState<EventType>('attack')
  const [opponentId, setOpponentId] = useState<string | null>(null)
  const [zone, setZone] = useState<number | null>(null)
  const positions = view.court?.currentPositions ?? {}
  const onCourt = [1, 2, 3, 4, 5, 6].map(p => positions[String(p)]).filter(Boolean)
  const lastCoded = [...view.events].reverse().find(e => e.eventType !== 'point')
  const needsPlayer = team === 'us' && !selectedPlayerId
  const large = size === 'large'

  const code = (outcome: string) => {
    if (needsPlayer) return
    live.logEvent({ team, eventType, outcome, playerId: team === 'us' ? selectedPlayerId : null, opponentPlayerId: team === 'opponent' ? opponentId : null, zone })
    setZone(null)
  }

  return (
    <section className={`flex flex-col ${large ? 'gap-4' : 'gap-2.5'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-widest text-muted truncate">
          Event coding
          {needsPlayer && <span className="text-opp ml-2">· pick a player</span>}
        </p>
        <div className="flex gap-1.5 shrink-0">
          <Pill selected={team === 'us'} tone="us" onClick={() => setTeam('us')}>Our team</Pill>
          <Pill selected={team === 'opponent'} tone="opp" onClick={() => { setTeam('opponent'); onSelectPlayer(null) }}>Opponent</Pill>
        </div>
      </div>

      {team === 'opponent' && (
        <div className="flex items-center gap-1.5 min-h-[3.75rem]">
          <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
            {view.opponentPlayers.length === 0 && <span className="text-[11px] text-muted">Team-level coding. Add the opponent roster to code by player.</span>}
            {view.opponentPlayers.slice(0, 14).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpponentId(opponentId === p.id ? null : p.id)}
                className={`w-9 h-9 pointer-coarse:w-11 pointer-coarse:h-11 rounded-full border-2 text-xs font-bold transition-motion-fast ${opponentId === p.id ? 'bg-opp border-select text-white' : 'bg-token border-opp text-white'}`}
              >
                {p.jersey}
              </button>
            ))}
          </div>
          {onOpenRoster && <Pill tone="plain" onClick={onOpenRoster}>Roster</Pill>}
        </div>
      )}

      <div className={`grid grid-cols-6 gap-1.5 ${team === 'opponent' ? 'hidden' : ''}`}>
        {onCourt.map(p => {
          const player = view.players.find(pl => pl.id === p.playerId)
          const selected = selectedPlayerId === p.playerId
          return (
            <button
              key={p.playerId}
              type="button"
              onClick={() => onSelectPlayer(selected ? null : p.playerId)}
              className="flex flex-col items-center gap-0.5 min-w-0 pointer-coarse:min-h-11"
            >
              <span
                className={`rounded-full border-2 flex items-center justify-center font-bold transition-motion-fast ${large ? 'w-14 h-14 text-lg' : 'w-11 h-11 text-sm'} ${
                  selected ? 'bg-us border-select text-white' : p.isLibero ? 'bg-token border-libero text-white' : 'bg-token border-us text-white'
                }`}
              >
                {player?.number}
              </span>
              <span className={`text-[10px] truncate max-w-full ${p.isLibero ? 'text-libero' : 'text-libero/80'}`}>{lastName(p.playerName)}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {EVENT_TYPES.map(t => (
          <Pill key={t.key} selected={eventType === t.key} tone="us" onClick={() => setEventType(t.key)} className="px-0">
            {t.short}
          </Pill>
        ))}
      </div>

      {team === 'us' && eventType === 'attack' && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-widest text-muted mr-1">Zone</span>
          {[4, 3, 2, 5, 6, 1].map(z => (
            <Pill key={z} tone="plain" selected={zone === z} onClick={() => setZone(zone === z ? null : z)} className="px-2.5">{z}</Pill>
          ))}
          <span className="text-[9px] text-muted ml-1 hidden xl:inline">optional</span>
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        {OUTCOMES[eventType].map(o => (
          <button
            key={o.key}
            type="button"
            disabled={needsPlayer}
            onClick={() => code(o.key)}
            className={`rounded border uppercase tracking-widest font-semibold transition-motion-fast disabled:opacity-30 disabled:cursor-not-allowed ${
              large ? 'h-16 text-sm' : 'h-12 text-xs'
            } ${OUTCOME_STYLE[o.tone]}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <p className="text-muted truncate">
          {lastCoded ? <>Last: {eventLabel(lastCoded, view.players)}</> : 'No events yet'}
          {lastCoded && !lastCoded.pending && (
            <button type="button" onClick={() => live.undo()} disabled={live.busy} className="ml-2 underline text-libero hover:text-white pointer-coarse:min-h-11">
              undo
            </button>
          )}
        </p>
        <div className="flex gap-3 shrink-0">
          <button type="button" onClick={() => live.scorePoint('us')} className="uppercase tracking-widest text-us hover:text-libero pointer-coarse:min-h-11">+1 us</button>
          <button type="button" onClick={() => live.scorePoint('opponent')} className="uppercase tracking-widest text-opp hover:text-opp-soft pointer-coarse:min-h-11">+1 them</button>
        </div>
      </div>
    </section>
  )
}

export default EventCoder
