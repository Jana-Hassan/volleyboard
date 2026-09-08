import { EventEmitter } from 'events'
import type {
  AnyDomainEvent,
  DomainEvent,
  DomainEventName,
  DomainEventPayloads
} from './domain-events'



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

export const publishAll = (events: AnyDomainEvent[]): void => {
  for (const event of events) {
    publish(event.name, event.matchId, event.payload as never)
  }
}

export const clearSubscribers = (): void => {
  emitter.removeAllListeners()
}
