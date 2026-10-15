import { Prisma, MatchEvent } from '@prisma/client'
import prisma from '../lib/prisma'
import { rotationStateFromRow, courtView } from './rotation.service'
import { ActiveSet, loadActiveSetWithin, assertNoPendingChallenge } from './set-context'
import { publishAll } from '../events/event-bus'
import { stampWithin } from './set-version'
import { calculateLiveStats } from './event.service'
import { AnyDomainEvent, EVENT_UNDONE, EventUndonePayload } from '../events/domain-events'

interface PointPayload {
  before?: { ourScore: number; opponentScore: number; servingTeam: 'us' | 'opponent'; currentRotation: number }
  rotationId?: string
  sourceEventId?: string
}

export interface RevertResult {
  payload: EventUndonePayload
  revertedPoint: MatchEvent | null
}

export const latestActionWithin = async (
  tx: Prisma.TransactionClient,
  setId: string
): Promise<{ events: MatchEvent[]; point: MatchEvent | null }> => {
  const latest = await tx.matchEvent.findFirst({ where: { setId }, orderBy: { occurredAt: 'desc' } })
  if (!latest) throw new Error('NOTHING_TO_UNDO')

  if (latest.eventType === 'point') {
    const sourceId = (latest.payload as PointPayload).sourceEventId
    const source = sourceId ? await tx.matchEvent.findUnique({ where: { id: sourceId } }) : null
    return { events: source ? [latest, source] : [latest], point: latest }
  }

  const point = await tx.matchEvent.findFirst({
    where: { setId, eventType: 'point', payload: { path: ['sourceEventId'], equals: latest.id } }
  })
  return { events: point ? [point, latest] : [latest], point }
}

export const revertLatestActionWithin = async (
  tx: Prisma.TransactionClient,
  active: ActiveSet,
  allowChallengeId?: string
): Promise<RevertResult> => {
  const { set } = active
  const { events, point } = await latestActionWithin(tx, set.id)
  const at = new Date(Math.min(...events.map(e => e.occurredAt.getTime())))
  const pointData = (point?.payload ?? {}) as PointPayload

  const [laterRotations, laterSubs, laterTimeouts, laterChallenges] = await Promise.all([
    tx.rotation.count({ where: { setId: set.id, recordedAt: { gt: at }, ...(pointData.rotationId ? { id: { not: pointData.rotationId } } : {}) } }),
    tx.substitution.count({ where: { setId: set.id, subbedAt: { gt: at } } }),
    tx.timeout.count({ where: { setId: set.id, calledAt: { gt: at } } }),
    tx.challenge.count({ where: { setId: set.id, challengedAt: { gt: at }, ...(allowChallengeId ? { id: { not: allowChallengeId } } : {}) } })
  ])
  if (laterRotations + laterSubs + laterTimeouts + laterChallenges > 0) throw new Error('UNDO_NOT_LATEST')

  let restored = { ourScore: set.ourScore, opponentScore: set.opponentScore, servingTeam: set.servingTeam, currentRotation: set.currentRotation }

  if (point) {
    if (!pointData.before) throw new Error('UNDO_UNSUPPORTED')
    restored = pointData.before
    await tx.matchSet.update({ where: { id: set.id }, data: restored })
    if (pointData.rotationId) await tx.rotation.delete({ where: { id: pointData.rotationId } })
  }

  await tx.matchEvent.deleteMany({ where: { id: { in: events.map(e => e.id) } } })

  const latestRotation = await tx.rotation.findFirstOrThrow({ where: { setId: set.id }, orderBy: { recordedAt: 'desc' } })
  const state = rotationStateFromRow(latestRotation, restored)

  return {
    revertedPoint: point,
    payload: {
      setId: set.id,
      removedEventIds: events.map(e => e.id),
      ourScore: restored.ourScore,
      opponentScore: restored.opponentScore,
      servingTeam: restored.servingTeam as 'us' | 'opponent',
      currentRotation: restored.currentRotation,
      currentPositions: courtView(state),
      rotationOrder: state.positions,
      libero: state.libero?.onCourt ?? null
    }
  }
}

export const undoLastAction = async (setId: string, userId: string): Promise<EventUndonePayload> => {
  const { payload, events, matchId } = await prisma.$transaction(async (tx) => {
    const active = await loadActiveSetWithin(tx, setId, userId, 'match.code')
    assertNoPendingChallenge(active.pendingChallenge)

    const { payload } = await revertLatestActionWithin(tx, active)
    const events = await stampWithin(tx, setId, [{ name: EVENT_UNDONE, matchId: active.set.matchId, payload }])
    return { payload: events[0].payload as EventUndonePayload, events, matchId: active.set.matchId }
  }, { timeout: 15000 })

  payload.liveStats = await calculateLiveStats(setId, matchId)
  publishAll(events)
  return payload
}
