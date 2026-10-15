import { Server } from 'socket.io'
import { subscribe } from '../events/event-bus'
import {
  MATCH_STARTED,
  SCORE_UPDATED,
  SET_FINISHED,
  MATCH_FINISHED,
  NEXT_SET_STARTED,
  MATCH_ENDED,
  LIBERO_CHANGED,
  SUBSTITUTION_MADE,
  TIMEOUT_CALLED,
  CHALLENGE_CALLED,
  CHALLENGE_RESOLVED,
  EVENT_UNDONE,
  EVENT_LOGGED,
  OPPONENT_ROSTER_CHANGED
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

  subscribe(LIBERO_CHANGED, (matchId, payload) => {
    io.to(room(matchId)).emit(LIBERO_CHANGED, payload)
  })

  subscribe(SUBSTITUTION_MADE, (matchId, payload) => {
    io.to(room(matchId)).emit(SUBSTITUTION_MADE, payload)
  })

  subscribe(TIMEOUT_CALLED, (matchId, payload) => {
    io.to(room(matchId)).emit(TIMEOUT_CALLED, payload)
  })

  subscribe(CHALLENGE_CALLED, (matchId, payload) => {
    io.to(room(matchId)).emit(CHALLENGE_CALLED, payload)
  })

  subscribe(CHALLENGE_RESOLVED, (matchId, payload) => {
    io.to(room(matchId)).emit(CHALLENGE_RESOLVED, payload)
  })

  subscribe(EVENT_UNDONE, (matchId, payload) => {
    io.to(room(matchId)).emit(EVENT_UNDONE, payload)
  })

  subscribe(EVENT_LOGGED, (matchId, payload) => {
    io.to(room(matchId)).emit(EVENT_LOGGED, payload)
  })

  subscribe(OPPONENT_ROSTER_CHANGED, (matchId, payload) => {
    io.to(room(matchId)).emit(OPPONENT_ROSTER_CHANGED, payload)
  })

  console.log('Match domain event publisher registered')
}
