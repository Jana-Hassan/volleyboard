import prisma from '../lib/prisma'
import { assertCanSubstitute, SubRequest } from '../fsm/match.fsm'
import { substitute, courtView, serializePositions, serializeLibero } from './rotation.service'
import { loadActiveSetWithin, assertNoPendingChallenge } from './set-context'
import { publishAll } from '../events/event-bus'
import { stampWithin } from './set-version'
import { AnyDomainEvent, SUBSTITUTION_MADE, SubstitutionMadePayload } from '../events/domain-events'

export const substitutePlayers = async (
  setId: string,
  userId: string,
  requests: SubRequest[]
): Promise<SubstitutionMadePayload> => {
  const { payload, events } = await prisma.$transaction(async (tx) => {
    const { set, state, rally, pendingChallenge } = await loadActiveSetWithin(tx, setId, userId, 'match.resources')
    assertNoPendingChallenge(pendingChallenge)

    const slots = set.match.lineup.slots
    const idsWithRole = (role: string) => slots.filter(s => s.role === role).map(s => s.playerId)
    const lastRequest = set.substitutions[set.substitutions.length - 1]

    assertCanSubstitute({
      subCount: set.subCount,
      history: set.substitutions.map(s => ({ playerOutId: s.playerOutId, playerInId: s.playerInId })),
      starterIds: idsWithRole('starter'),
      benchIds: idsWithRole('bench'),
      liberoIds: idsWithRole('libero'),
      onCourtIds: Object.values(state.positions).map(p => p.playerId),
      liberoReplacingId: state.libero?.onCourt?.replacedPlayerId ?? null,
      rally,
      lastRequestRally: lastRequest ? lastRequest.atScoreUs + lastRequest.atScoreThem : null
    }, requests)

    let next = state
    const subbedAt = new Date()
    for (const { playerOutId, playerInId } of requests) {
      const incoming = slots.find(s => s.playerId === playerInId)!.player
      next = substitute(next, playerOutId, { playerId: incoming.id, playerName: incoming.name })
      await tx.substitution.create({
        data: { setId, playerOutId, playerInId, atScoreUs: set.ourScore, atScoreThem: set.opponentScore, subbedAt }
      })
    }

    const updated = await tx.matchSet.update({
      where: { id: setId },
      data: { subCount: { increment: requests.length } }
    })

    await tx.rotation.create({
      data: {
        setId,
        rotationNumber: set.currentRotation,
        positions: serializePositions(next.positions),
        libero: serializeLibero(next.libero) as object,
        recordedAt: new Date()
      }
    })

    const payload: SubstitutionMadePayload = {
      setId,
      substitutions: requests,
      subCount: updated.subCount,
      atScoreUs: set.ourScore,
      atScoreThem: set.opponentScore,
      currentPositions: courtView(next),
      rotationOrder: next.positions,
      libero: next.libero?.onCourt ?? null
    }
    const events = await stampWithin(tx, setId, [{ name: SUBSTITUTION_MADE, matchId: set.matchId, payload }])
    return { payload: events[0].payload as SubstitutionMadePayload, events }
  }, { timeout: 15000 })

  publishAll(events)
  return payload
}
