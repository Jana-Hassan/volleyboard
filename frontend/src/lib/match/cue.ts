import type { LiveEvent } from './types'

export interface ScoringCue {
  playerId: string
  tone: 'us' | 'opp'
  key: string
}

const POINT_FOR_ACTOR = ['kill', 'ace']
const POINT_FOR_OPPONENT = ['error']

const fromCodedEvent = (event: LiveEvent): ScoringCue | null => {
  if (event.team !== 'us' || !event.playerId) return null
  const key = event.clientEventId ?? event.id
  if (POINT_FOR_ACTOR.includes(event.outcome)) return { playerId: event.playerId, tone: 'us', key }
  if (POINT_FOR_OPPONENT.includes(event.outcome)) return { playerId: event.playerId, tone: 'opp', key }
  return null
}

export const scoringCue = (events: LiveEvent[]): ScoringCue | null => {
  const last = events[events.length - 1]
  if (!last) return null
  if (last.eventType !== 'point') return fromCodedEvent(last)

  const sourceId = (last.payload as { sourceEventId?: string } | undefined)?.sourceEventId
  const source = sourceId ? events.find(e => e.id === sourceId) : undefined
  return source ? fromCodedEvent(source) : null
}
