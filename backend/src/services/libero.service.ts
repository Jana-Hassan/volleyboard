import prisma from '../lib/prisma'
import {
  liberoIn,
  liberoOut,
  courtView,
  serializePositions,
  serializeLibero
} from './rotation.service'
import { loadActiveSetWithin, assertNoPendingChallenge } from './set-context'
import { publishAll } from '../events/event-bus'
import { stampWithin } from './set-version'
import { AnyDomainEvent, LIBERO_CHANGED, LiberoChangedPayload } from '../events/domain-events'

export type LiberoChange =
  | { action: 'in'; liberoId: string; replacedPlayerId: string }
  | { action: 'out' }

/**
 * Put the libero on for a back-row player, swap liberos, or take the libero
 * off. The rules live in rotation.service; this only loads, saves and
 * announces. Libero replacements are not substitutions (FIVB 19.3.2.1), so
 * subCount is untouched.
 */
export const changeLibero = async (
  setId: string,
  userId: string,
  change: LiberoChange
): Promise<LiberoChangedPayload> => {
  const { payload, events } = await prisma.$transaction(async (tx) => {
    const { set, state, rally, pendingChallenge } = await loadActiveSetWithin(tx, setId, userId, 'match.code')
    assertNoPendingChallenge(pendingChallenge)

    let next
    if (change.action === 'in') {
      const slot = set.match.lineup.slots.find(
        s => s.role === 'libero' && s.playerId === change.liberoId
      )
      if (!slot) throw new Error('LIBERO_NOT_IN_LINEUP')
      next = liberoIn(
        state,
        { playerId: slot.player.id, playerName: slot.player.name },
        change.replacedPlayerId,
        rally
      )
    } else {
      next = liberoOut(state, rally)
    }

    await tx.rotation.create({
      data: {
        setId,
        rotationNumber: set.currentRotation,
        positions: serializePositions(next.positions),
        libero: serializeLibero(next.libero) as object,
        recordedAt: new Date()
      }
    })

    const payload: LiberoChangedPayload = {
      setId,
      currentPositions: courtView(next),
      rotationOrder: next.positions,
      libero: next.libero?.onCourt ?? null
    }
    const events = await stampWithin(tx, setId, [{ name: LIBERO_CHANGED, matchId: set.matchId, payload }])
    return { payload: events[0].payload as LiberoChangedPayload, events }
  }, { timeout: 15000 })

  publishAll(events)

  return payload
}
