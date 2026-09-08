import { Server } from 'socket.io'
import { subscribe } from '../events/event-bus'
import {
  MATCH_STARTED,
  SCORE_UPDATED,
  SET_FINISHED,
  MATCH_FINISHED,
  NEXT_SET_STARTED,
  MATCH_ENDED
} from '../events/domain-events'

/**
 * The only place that translates domain events into Socket.io traffic.
 *
 * Every payload is forwarded verbatim, so the wire format is identical to when
 * the services emitted directly. `io` arrives as an argument from the
 * composition root — nothing here is imported from index.ts.
 */
export const registerMatchPublisher = (io: Server): void => {
  const room = (matchId: string) => `match:${matchId}`

  subscribe(MATCH_STARTED, (matchId, payload) => {
    io.to(room(matchId)).emit(MATCH_STARTED, payload)
  })

  subscribe(SCORE_UPDATED, (matchId, payload) => {
    io.to(room(matchId)).emit(SCORE_UPDATED, payload)
  })

  subscribe(SET_FINISHED, (matchId, payload) => {
    io.to(room(matchId)).emit(SET_FINISHED, payload)
  })

  subscribe(MATCH_FINISHED, (matchId, payload) => {
    io.to(room(matchId)).emit(MATCH_FINISHED, payload)
  })

  subscribe(NEXT_SET_STARTED, (matchId, payload) => {
    io.to(room(matchId)).emit(NEXT_SET_STARTED, payload)
  })

  subscribe(MATCH_ENDED, (matchId, payload) => {
    io.to(room(matchId)).emit(MATCH_ENDED, payload)
  })

  console.log('Match domain event publisher registered')
}
