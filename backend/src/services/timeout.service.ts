import prisma from '../lib/prisma'
import { assertCanCallTimeout, Team } from '../fsm/match.fsm'
import { loadActiveSetWithin, assertNoPendingChallenge } from './set-context'
import { publishAll } from '../events/event-bus'
import { stampWithin } from './set-version'
import { AnyDomainEvent, TIMEOUT_CALLED, TimeoutCalledPayload } from '../events/domain-events'

export const callTimeout = async (
  setId: string,
  userId: string,
  calledBy: Team
): Promise<TimeoutCalledPayload> => {
  const { payload, events } = await prisma.$transaction(async (tx) => {
    const { set, pendingChallenge } = await loadActiveSetWithin(tx, setId, userId, 'match.resources')
    assertNoPendingChallenge(pendingChallenge)

    assertCanCallTimeout(calledBy === 'us' ? set.ourTimeoutsRemaining : set.oppTimeoutsRemaining)

    await tx.timeout.create({
      data: { setId, calledBy, atScoreUs: set.ourScore, atScoreThem: set.opponentScore, calledAt: new Date() }
    })

    const updated = await tx.matchSet.update({
      where: { id: setId },
      data: calledBy === 'us'
        ? { ourTimeoutsRemaining: { decrement: 1 } }
        : { oppTimeoutsRemaining: { decrement: 1 } }
    })

    const payload: TimeoutCalledPayload = {
      setId,
      calledBy,
      ourTimeoutsRemaining: updated.ourTimeoutsRemaining,
      oppTimeoutsRemaining: updated.oppTimeoutsRemaining,
      atScoreUs: set.ourScore,
      atScoreThem: set.opponentScore
    }
    const events = await stampWithin(tx, setId, [{ name: TIMEOUT_CALLED, matchId: set.matchId, payload }])
    return { payload: events[0].payload as TimeoutCalledPayload, events }
  }, { timeout: 15000 })

  publishAll(events)
  return payload
}
