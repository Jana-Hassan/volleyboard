import type { LiveEvent, LivePlayer } from './types'

export type EventType = 'attack' | 'serve' | 'reception' | 'block' | 'dig' | 'set'

export const EVENT_TYPES: { key: EventType; short: string; label: string }[] = [
  { key: 'attack', short: 'ATK', label: 'Attack' },
  { key: 'serve', short: 'SRV', label: 'Serve' },
  { key: 'reception', short: 'REC', label: 'Reception' },
  { key: 'block', short: 'BLK', label: 'Block' },
  { key: 'dig', short: 'DIG', label: 'Dig' },
  { key: 'set', short: 'SET', label: 'Set' }
]

export type Tone = 'good' | 'bad' | 'neutral'

export const OUTCOMES: Record<EventType, { key: string; label: string; tone: Tone }[]> = {
  attack: [{ key: 'kill', label: 'Kill', tone: 'good' }, { key: 'error', label: 'Error', tone: 'bad' }, { key: 'in_play', label: 'In Play', tone: 'neutral' }, { key: 'blocked', label: 'Blocked', tone: 'neutral' }],
  serve: [{ key: 'ace', label: 'Ace', tone: 'good' }, { key: 'error', label: 'Error', tone: 'bad' }, { key: 'in_play', label: 'In Play', tone: 'neutral' }],
  reception: [{ key: 'perfect', label: 'Perfect', tone: 'good' }, { key: 'good', label: 'Good', tone: 'neutral' }, { key: 'error', label: 'Error', tone: 'bad' }],
  block: [{ key: 'kill', label: 'Kill', tone: 'good' }, { key: 'touch', label: 'Touch', tone: 'neutral' }, { key: 'error', label: 'Error', tone: 'bad' }, { key: 'in_play', label: 'In Play', tone: 'neutral' }],
  dig: [{ key: 'perfect', label: 'Perfect', tone: 'good' }, { key: 'good', label: 'Good', tone: 'neutral' }, { key: 'error', label: 'Error', tone: 'bad' }],
  set: [{ key: 'perfect', label: 'Perfect', tone: 'good' }, { key: 'good', label: 'Good', tone: 'neutral' }, { key: 'error', label: 'Error', tone: 'bad' }]
}

const NAMED: Record<string, string> = {
  'serve:ace': 'Ace',
  'serve:error': 'Serve error',
  'attack:kill': 'Kill',
  'attack:error': 'Attack error',
  'attack:blocked': 'Blocked',
  'block:kill': 'Block',
  'block:error': 'Block error',
  'reception:error': 'Reception error',
  'dig:error': 'Dig error',
  'set:error': 'Set error'
}

export const CHALLENGE_TYPES: { key: string; label: string }[] = [
  { key: 'in_out', label: 'In / Out' },
  { key: 'block_touch', label: 'Block touch' },
  { key: 'net_touch', label: 'Net touch' },
  { key: 'foot_fault', label: 'Foot fault' },
  { key: 'antenna', label: 'Antenna' },
  { key: 'ball_touched_floor', label: 'Ball on floor' },
  { key: 'other', label: 'Other' }
]

export const actionLabel = (eventType: string, outcome: string): string => {
  const named = NAMED[`${eventType}:${outcome}`]
  if (named) return named
  const type = EVENT_TYPES.find(t => t.key === eventType)?.label ?? eventType
  const result = Object.values(OUTCOMES).flat().find(o => o.key === outcome)?.label ?? outcome
  return `${type} ${result.toLowerCase()}`
}

const SURNAME_PARTICLES = new Set(['de', 'da', 'di', 'del', 'della', 'do', 'dos', 'du', 'van', 'von', 'der', 'den', 'le', 'la', 'mac', 'st', 'st.'])

export const lastName = (name: string): string => {
  const parts = name.trim().split(/\s+/)
  let start = parts.length - 1
  while (start > 0 && SURNAME_PARTICLES.has(parts[start - 1].toLowerCase())) start--
  return parts.slice(start).join(' ') || name
}

export const playerTag = (player: Pick<LivePlayer, 'number' | 'name'> | undefined): string =>
  player ? `#${player.number} ${lastName(player.name)}` : 'Player'

export const eventLabel = (event: LiveEvent, players: LivePlayer[]): string => {
  const who = event.team === 'us' ? playerTag(players.find(p => p.id === event.playerId)) : 'Opponent'
  return `${who} · ${actionLabel(event.eventType, event.outcome)}`
}
