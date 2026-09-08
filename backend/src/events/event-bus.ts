import { EventEmitter } from 'events'
import type { DomainEvent, DomainEventName, DomainEventPayloads } from './domain-events'

/**
 * In-process domain event bus.
 *
 * The service layer publishes facts here; transports (Socket.io) subscribe.
 * This keeps the dependency arrow pointing away from the composition root:
 * services no longer import `io` from index.ts.
 *
 * Delivery is synchronous and ordered, which matters — clients rely on
 * score_updated arriving before set_finished before match_finished.
 */

const emitter = new EventEmitter()

// A subscriber blowing up must never fail the request that published the
// event. The DB transaction has already committed by the time we get here.
export const subscribe = <N extends DomainEventName>(
  name: N,
  handler: (matchId: string, payload: DomainEventPayloads[N]) => void
): void => {
  emitter.on(name, (event: DomainEvent<N>) => {
    try {
      handler(event.matchId, event.payload)
    } catch (error) {
      console.error(`Domain event subscriber failed for "${name}":`, error)
    }
  })
}

export const publish = <N extends DomainEventName>(
  name: N,
  matchId: string,
  payload: DomainEventPayloads[N]
): void => {
  emitter.emit(name, { name, matchId, payload } satisfies DomainEvent<N>)
}

// Test helper: drop all subscribers between cases.
export const clearSubscribers = (): void => {
  emitter.removeAllListeners()
}
