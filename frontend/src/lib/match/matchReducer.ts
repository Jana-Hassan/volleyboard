import type {
  LiveAction,
  LiveEvent,
  LiveSnapshot,
  LiveState,
  PendingAction,
  Court,
  LiveStats,
  Team
} from './types'

export const initialLiveState: LiveState = { base: null, pending: [], needsResync: false }

const RESYNC_MESSAGES = ['match_started', 'next_set_started', 'match_ended']

type Payload = Record<string, unknown>

const courtFrom = (p: Payload, fallback: Court | null): Court | null =>
  p.currentPositions
    ? {
        currentPositions: p.currentPositions as Court['currentPositions'],
        rotationOrder: p.rotationOrder as Court['rotationOrder'],
        libero: (p.libero ?? null) as Court['libero']
      }
    : fallback

const withSetScore = (snap: LiveSnapshot, ourScore: number, opponentScore: number): LiveSnapshot['sets'] =>
  snap.sets.map(s => (s.id === snap.activeSet?.id ? { ...s, ourScore, opponentScore } : s))

const appendEvent = (events: LiveEvent[], event: LiveEvent | undefined): LiveEvent[] =>
  !event || events.some(e => e.id === event.id) ? events : [...events, event]

const apply = (snap: LiveSnapshot, name: string, p: Payload): LiveSnapshot => {
  const set = snap.activeSet!
  switch (name) {
    case 'score_updated': {
      const ourScore = p.ourScore as number
      const opponentScore = p.opponentScore as number
      return {
        ...snap,
        activeSet: { ...set, ourScore, opponentScore, servingTeam: p.servingTeam as Team, currentRotation: p.currentRotation as number },
        court: courtFrom(p, snap.court),
        events: appendEvent(snap.events, p.event as LiveEvent | undefined),
        sets: withSetScore(snap, ourScore, opponentScore)
      }
    }
    case 'event_logged':
      return {
        ...snap,
        events: appendEvent(snap.events, p.event as LiveEvent),
        liveStats: (p.liveStats as LiveStats | undefined) ?? snap.liveStats
      }
    case 'event_undone': {
      const removed = p.removedEventIds as string[]
      const ourScore = p.ourScore as number
      const opponentScore = p.opponentScore as number
      return {
        ...snap,
        activeSet: { ...set, ourScore, opponentScore, servingTeam: p.servingTeam as Team, currentRotation: p.currentRotation as number },
        court: courtFrom(p, snap.court),
        events: snap.events.filter(e => !removed.includes(e.id)),
        sets: withSetScore(snap, ourScore, opponentScore),
        liveStats: (p.liveStats as LiveStats | undefined) ?? snap.liveStats
      }
    }
    case 'libero_changed':
      return { ...snap, court: courtFrom(p, snap.court) }
    case 'substitution_made': {
      const subs = (p.substitutions as { playerOutId: string; playerInId: string }[]).map(s => ({
        ...s, atScoreUs: p.atScoreUs as number, atScoreThem: p.atScoreThem as number
      }))
      return {
        ...snap,
        activeSet: { ...set, subCount: p.subCount as number },
        court: courtFrom(p, snap.court),
        substitutions: [...snap.substitutions, ...subs]
      }
    }
    case 'timeout_called':
      return {
        ...snap,
        activeSet: { ...set, ourTimeoutsRemaining: p.ourTimeoutsRemaining as number, oppTimeoutsRemaining: p.oppTimeoutsRemaining as number },
        timeouts: [...snap.timeouts, { calledBy: p.calledBy as Team, atScoreUs: p.atScoreUs as number, atScoreThem: p.atScoreThem as number }]
      }
    case 'challenge_called':
      return {
        ...snap,
        challenges: [...snap.challenges, {
          id: p.challengeId as string,
          challenger: p.challenger as Team,
          callType: p.callType as string,
          successful: null,
          atScoreUs: p.atScoreUs as number,
          atScoreThem: p.atScoreThem as number
        }]
      }
    case 'challenge_resolved':
      return {
        ...snap,
        activeSet: { ...set, ourChallengesRemaining: p.ourChallengesRemaining as number, oppChallengesRemaining: p.oppChallengesRemaining as number },
        challenges: snap.challenges.map(c => (c.id === p.challengeId ? { ...c, successful: p.successful as boolean } : c))
      }
    case 'set_finished': {
      const ourScore = p.ourScore as number
      const opponentScore = p.opponentScore as number
      return {
        ...snap,
        activeSet: { ...set, ourScore, opponentScore, status: 'finished' },
        sets: snap.sets.map(s => (s.id === set.id ? { ...s, ourScore, opponentScore, status: 'finished' } : s)),
        ourSetsWon: p.ourSetsWon as number,
        opponentSetsWon: p.opponentSetsWon as number
      }
    }
    case 'match_finished':
      return {
        ...snap,
        match: { ...snap.match, status: 'completed' },
        matchOver: true,
        ourSetsWon: p.ourSetsWon as number,
        opponentSetsWon: p.opponentSetsWon as number
      }
    default:
      return snap
  }
}

const withoutPending = (pending: PendingAction[], clientEventId: unknown): PendingAction[] =>
  typeof clientEventId === 'string' ? pending.filter(a => a.clientEventId !== clientEventId) : pending

const onMessage = (state: LiveState, name: string, p: Payload): LiveState => {
  const base = state.base
  if (!base) return state
  if (RESYNC_MESSAGES.includes(name)) return { ...state, needsResync: true }

  const set = base.activeSet
  if (!set || p.setId !== set.id) return { ...state, needsResync: true }

  const version = p.version as number
  if (version <= set.version) return state
  if (version > set.version + 1) return { ...state, needsResync: true }

  const next = apply(base, name, p)
  return {
    ...state,
    base: { ...next, activeSet: { ...next.activeSet!, version } },
    pending: withoutPending(state.pending, p.clientEventId)
  }
}

const onSnapshot = (state: LiveState, snapshot: LiveSnapshot): LiveState => {
  const current = state.base?.activeSet
  const incoming = snapshot.activeSet
  if (current && incoming && current.id === incoming.id && incoming.version < current.version) return state

  const known = new Set(snapshot.events.map(e => e.clientEventId).filter(Boolean))
  return {
    base: snapshot,
    pending: state.pending.filter(a => !known.has(a.clientEventId)),
    needsResync: false
  }
}

export const liveReducer = (state: LiveState, action: LiveAction): LiveState => {
  switch (action.type) {
    case 'snapshot':
      return onSnapshot(state, action.snapshot)
    case 'message':
      return onMessage(state, action.name, action.payload)
    case 'optimistic':
      return { ...state, pending: [...state.pending, action.action] }
    case 'rollback':
      return { ...state, pending: withoutPending(state.pending, action.clientEventId) }
  }
}

export const viewOf = (state: LiveState): LiveSnapshot | null => {
  const base = state.base
  if (!base || !base.activeSet || base.activeSet.status !== 'active' || state.pending.length === 0) return base

  let view: LiveSnapshot = base
  for (const action of state.pending) {
    const set = view.activeSet!
    const scorer = action.scorer
    if (scorer) {
      const ourScore = set.ourScore + (scorer === 'us' ? 1 : 0)
      const opponentScore = set.opponentScore + (scorer === 'opponent' ? 1 : 0)
      view = {
        ...view,
        activeSet: { ...set, ourScore, opponentScore, servingTeam: scorer },
        sets: withSetScore(view, ourScore, opponentScore)
      }
    }
    if (action.kind === 'event') {
      view = {
        ...view,
        events: [...view.events, {
          id: action.clientEventId,
          clientEventId: action.clientEventId,
          team: action.team,
          eventType: action.eventType,
          outcome: action.outcome,
          playerId: action.playerId,
          opponentPlayerId: action.opponentPlayerId ?? null,
          rotation: set.currentRotation,
          occurredAt: new Date().toISOString(),
          pending: true
        }]
      }
    }
  }
  return view
}
