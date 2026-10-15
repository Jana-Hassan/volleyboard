import prisma from '../lib/prisma'
import { assertCanChallenge, resolveChallengeOutcome, Team } from '../fsm/match.fsm'
import { loadActiveSetWithin } from './set-context'
import { latestActionWithin, revertLatestActionWithin } from './undo.service'
import { scorePointWithin } from './scoring.service'
import { publishAll } from '../events/event-bus'
import { stampWithin } from './set-version'
import { calculateLiveStats } from './event.service'
import {
  AnyDomainEvent,
  CHALLENGE_CALLED,
  CHALLENGE_RESOLVED,
  EVENT_UNDONE,
  ChallengeCalledPayload,
  ChallengeResolvedPayload,
  EventUndonePayload
} from '../events/domain-events'

export const callChallenge = async (
  setId: string,
  userId: string,
  input: { challenger: Team; callType: string }
): Promise<ChallengeCalledPayload> => {
  const { payload, events } = await prisma.$transaction(async (tx) => {
    const { set, rally, pendingChallenge } = await loadActiveSetWithin(tx, setId, userId, 'match.resources')

    assertCanChallenge({
      remaining: input.challenger === 'us' ? set.ourChallengesRemaining : set.oppChallengesRemaining,
      pending: pendingChallenge !== null,
      rally,
      challengedRallies: set.challenges
        .filter(c => c.challenger === input.challenger)
        .map(c => c.atScoreUs + c.atScoreThem)
    })

    const challenge = await tx.challenge.create({
      data: {
        setId,
        challenger: input.challenger,
        callType: input.callType,
        atScoreUs: set.ourScore,
        atScoreThem: set.opponentScore,
        challengedAt: new Date()
      }
    })

    const payload: ChallengeCalledPayload = {
      setId,
      challengeId: challenge.id,
      challenger: input.challenger,
      callType: input.callType,
      atScoreUs: set.ourScore,
      atScoreThem: set.opponentScore
    }
    const events = await stampWithin(tx, setId, [{ name: CHALLENGE_CALLED, matchId: set.matchId, payload }])
    return { payload: events[0].payload as ChallengeCalledPayload, events }
  }, { timeout: 15000 })

  publishAll(events)
  return payload
}

export const resolveChallenge = async (
  setId: string,
  challengeId: string,
  userId: string,
  input: { successful: boolean; awardPoint: boolean }
): Promise<ChallengeResolvedPayload> => {
  const { payload, events, matchId } = await prisma.$transaction(async (tx) => {
    const active = await loadActiveSetWithin(tx, setId, userId, 'match.resources')
    const challenge = active.set.challenges.find(c => c.id === challengeId)
    if (!challenge) throw new Error('CHALLENGE_NOT_FOUND')
    if (challenge.successful !== null) throw new Error('CHALLENGE_ALREADY_RESOLVED')

    const challenger = challenge.challenger as Team
    const lastPoint = await tx.matchEvent.findFirst({
      where: { setId, eventType: 'point' },
      orderBy: { occurredAt: 'desc' }
    })
    if (!lastPoint) throw new Error('NOTHING_TO_CHALLENGE')

    const outcome = resolveChallengeOutcome({
      successful: input.successful,
      awardPoint: input.awardPoint,
      challenger,
      lastRallyWinner: lastPoint.team as Team
    })

    await tx.challenge.update({ where: { id: challengeId }, data: { successful: input.successful } })

    const events: AnyDomainEvent[] = []

    if (outcome.overturn) {
      const { point } = await latestActionWithin(tx, setId)
      if (point?.id !== lastPoint.id) throw new Error('UNDO_NOT_LATEST')
      const reverted = await revertLatestActionWithin(tx, active, challengeId)
      events.push({ name: EVENT_UNDONE, matchId: active.set.matchId, payload: reverted.payload })
      const scored = await scorePointWithin(tx, setId, userId, challenger)
      events.push(...scored.events)
    }

    const updated = outcome.consumesChallenge
      ? await tx.matchSet.update({
          where: { id: setId },
          data: challenger === 'us'
            ? { ourChallengesRemaining: { decrement: 1 } }
            : { oppChallengesRemaining: { decrement: 1 } }
        })
      : await tx.matchSet.findUniqueOrThrow({ where: { id: setId } })

    const payload: ChallengeResolvedPayload = {
      setId,
      challengeId,
      challenger,
      successful: input.successful,
      overturned: outcome.overturn,
      ourChallengesRemaining: updated.ourChallengesRemaining,
      oppChallengesRemaining: updated.oppChallengesRemaining
    }
    events.unshift({ name: CHALLENGE_RESOLVED, matchId: active.set.matchId, payload })
    const stamped = await stampWithin(tx, setId, events)
    return { payload: stamped[0].payload as ChallengeResolvedPayload, events: stamped, matchId: active.set.matchId }
  }, { timeout: 15000 })

  const undone = events.find(e => e.name === EVENT_UNDONE)
  if (undone) (undone.payload as EventUndonePayload).liveStats = await calculateLiveStats(setId, matchId)

  publishAll(events)
  return payload
}
