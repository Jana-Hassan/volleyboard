import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import api from '../lib/api'
import { liveReducer, viewOf, initialLiveState } from '../lib/match/matchReducer'
import type { LiveSnapshot, Team } from '../lib/match/types'

const SOCKET_EVENTS = [
  'score_updated', 'event_logged', 'event_undone', 'libero_changed', 'substitution_made',
  'timeout_called', 'challenge_called', 'challenge_resolved', 'set_finished', 'match_finished',
  'match_started', 'next_set_started', 'match_ended', 'opponent_roster_changed'
]

const ECHO_TIMEOUT_MS = 3000
const POINT_FOR_ACTOR = ['kill', 'ace']
const POINT_FOR_OPPONENT = ['error']

const errorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback

const scorerFor = (team: Team, outcome: string): Team | null => {
  if (POINT_FOR_ACTOR.includes(outcome)) return team
  if (POINT_FOR_OPPONENT.includes(outcome)) return team === 'us' ? 'opponent' : 'us'
  return null
}

export interface EventInput {
  team: Team
  eventType: string
  outcome: string
  playerId: string | null
  opponentPlayerId?: string | null
  zone?: number | null
}

export const useMatchLive = (matchId: string | undefined) => {
  const [state, dispatch] = useReducer(liveReducer, initialLiveState)
  const [connected, setConnected] = useState(false)
  const [loadError, setLoadError] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const loading = useRef(false)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const loadSnapshot = useCallback((): Promise<void> => {
    if (!matchId || loading.current) return Promise.resolve()
    loading.current = true
    return api.get<LiveSnapshot>(`/matches/${matchId}/live`)
      .then(res => {
        dispatch({ type: 'snapshot', snapshot: res.data })
        setLoadError(null)
      })
      .catch(err => setLoadError((err as { response?: { status?: number } })?.response?.status ?? 0))
      .finally(() => { loading.current = false })
  }, [matchId])

  const needsResync = state.needsResync

  useEffect(() => {
    if (!matchId) return
    const timer = setTimeout(() => { void loadSnapshot() }, 0)
    return () => clearTimeout(timer)
  }, [matchId, loadSnapshot])

  useEffect(() => {
    if (!needsResync) return
    const timer = setTimeout(() => { void loadSnapshot() }, 0)
    return () => clearTimeout(timer)
  }, [needsResync, loadSnapshot])

  useEffect(() => {
    if (!matchId) return
    const token = localStorage.getItem('token')
    if (!token) return

    const socket = io('http://localhost:3000', { auth: { token } })
    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join_match', { matchId })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('match_state', (snapshot: LiveSnapshot) => dispatch({ type: 'snapshot', snapshot }))
    for (const name of SOCKET_EVENTS) {
      socket.on(name, (payload: Record<string, unknown>) => dispatch({ type: 'message', name, payload }))
    }

    return () => {
      socket.emit('leave_match', { matchId })
      socket.disconnect()
    }
  }, [matchId])

  const send = useCallback(async (clientEventId: string, request: () => Promise<unknown>) => {
    try {
      await request()
      setTimeout(() => {
        if (stateRef.current.pending.some(a => a.clientEventId === clientEventId)) void loadSnapshot()
      }, ECHO_TIMEOUT_MS)
    } catch (err) {
      dispatch({ type: 'rollback', clientEventId })
      setActionError(errorMessage(err, 'That was not saved, so it was taken back'))
    }
  }, [loadSnapshot])

  const scorePoint = useCallback((scorer: Team) => {
    const set = stateRef.current.base?.activeSet
    if (!set || set.status !== 'active') return
    setActionError('')
    const clientEventId = crypto.randomUUID()
    dispatch({ type: 'optimistic', action: { kind: 'point', clientEventId, scorer } })
    void send(clientEventId, () => api.post(`/matches/sets/${set.id}/point`, { scorer, clientEventId }))
  }, [send])

  const logEvent = useCallback((input: EventInput) => {
    const set = stateRef.current.base?.activeSet
    if (!set || set.status !== 'active') return
    setActionError('')
    const clientEventId = crypto.randomUUID()
    const scorer = scorerFor(input.team, input.outcome)
    dispatch({ type: 'optimistic', action: { kind: 'event', clientEventId, ...input, scorer } })
    void send(clientEventId, () => api.post(`/sets/${set.id}/events`, {
      team: input.team,
      eventType: input.eventType,
      outcome: input.outcome,
      playerId: input.team === 'us' ? input.playerId ?? undefined : undefined,
      opponentPlayerId: input.team === 'opponent' ? input.opponentPlayerId ?? undefined : undefined,
      zone: input.team === 'us' && input.eventType === 'attack' ? input.zone ?? undefined : undefined,
      clientEventId
    }))
  }, [send])

  const runCommand = useCallback(async (path: string, body?: object) => {
    setBusy(true)
    setActionError('')
    try {
      await api.post(path, body)
      await loadSnapshot()
    } catch (err) {
      setActionError(errorMessage(err, 'Could not do that'))
    } finally {
      setBusy(false)
    }
  }, [loadSnapshot])

  const startMatch = useCallback((servingTeam?: Team) => runCommand(`/matches/${matchId}/start`, servingTeam ? { servingTeam } : undefined), [runCommand, matchId])
  const nextSet = useCallback((servingTeam?: Team) => runCommand(`/matches/${matchId}/next-set`, servingTeam ? { servingTeam } : undefined), [runCommand, matchId])

  const runSetAction = useCallback(async (method: 'post' | 'delete', path: string, body?: object): Promise<boolean> => {
    const set = stateRef.current.base?.activeSet
    if (!set || set.status !== 'active') return false
    setBusy(true)
    setActionError('')
    try {
      if (method === 'post') await api.post(`/sets/${set.id}${path}`, body)
      else await api.delete(`/sets/${set.id}${path}`)
      return true
    } catch (err) {
      setActionError(errorMessage(err, 'Could not do that'))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const substitute = useCallback((substitutions: { playerOutId: string; playerInId: string }[]) =>
    runSetAction('post', '/substitutions', { substitutions }), [runSetAction])
  const callTimeout = useCallback((calledBy: Team) => runSetAction('post', '/timeouts', { calledBy }), [runSetAction])
  const callChallenge = useCallback((challenger: Team, callType: string) =>
    runSetAction('post', '/challenges', { challenger, callType }), [runSetAction])
  const resolveChallenge = useCallback((challengeId: string, successful: boolean, awardPoint: boolean) =>
    runSetAction('post', `/challenges/${challengeId}/resolve`, { successful, awardPoint }), [runSetAction])
  const changeLibero = useCallback((change: { action: 'in'; liberoId: string; replacedPlayerId: string } | { action: 'out' }) =>
    runSetAction('post', '/libero', change), [runSetAction])
  const undo = useCallback(() => runSetAction('delete', '/events/last'), [runSetAction])

  const runMatchAction = useCallback(async (request: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true)
    setActionError('')
    try {
      await request()
      return true
    } catch (err) {
      setActionError(errorMessage(err, 'Could not do that'))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const addOpponentPlayer = useCallback((jersey: number, name: string) =>
    runMatchAction(() => api.post(`/matches/${matchId}/opponent-players`, { jersey, name: name || undefined })), [runMatchAction, matchId])
  const removeOpponentPlayer = useCallback((opponentPlayerId: string) =>
    runMatchAction(() => api.delete(`/matches/${matchId}/opponent-players/${opponentPlayerId}`)), [runMatchAction, matchId])

  const view = useMemo(() => viewOf(state), [state])
  const clearActionError = useCallback(() => setActionError(''), [])

  return {
    view,
    connected,
    loadError,
    actionError,
    clearActionError,
    busy,
    scorePoint,
    logEvent,
    startMatch,
    nextSet,
    substitute,
    callTimeout,
    callChallenge,
    resolveChallenge,
    changeLibero,
    undo,
    addOpponentPlayer,
    removeOpponentPlayer
  }
}

export type MatchLive = ReturnType<typeof useMatchLive>
