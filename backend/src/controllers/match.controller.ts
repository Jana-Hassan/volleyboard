import { Response, NextFunction } from 'express'
import type { AuthRequest } from '../types'
import {
  createMatch,
  startMatch,
  scorePoint,
  getMatchState,
  endSet,
  startNextSet,
  endMatch,
  getMatches
} from '../services/match.service'
import { getLiveSnapshot } from '../services/live.service'
import { getMatchReport } from '../services/report.service'
import { listOpponentPlayers, addOpponentPlayer, removeOpponentPlayer } from '../services/opponent.service'

const parseToss = (value: unknown): 'us' | 'opponent' | undefined | null => {
  if (value === undefined) return undefined
  return value === 'us' || value === 'opponent' ? value : null
}

export const create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const { lineupId, opponentName, competition, scheduledAt } = req.body
    if (!lineupId || !opponentName) {
      res.status(400).json({ error: 'lineupId and opponentName are required' })
      return
    }
    const match = await createMatch(teamId, req.user!.userId, {
      lineupId,
      opponentName,
      competition,
      scheduledAt
    })
    res.status(201).json(match)
  } catch (error) { next(error) }
}

export const start = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { matchId } = req.params as { matchId: string }
    const toss = parseToss(req.body?.servingTeam)
    if (toss === null) {
      res.status(400).json({ error: 'servingTeam must be "us" or "opponent"' })
      return
    }
    const result = await startMatch(matchId, req.user!.userId, toss)
    res.status(200).json(result)
  } catch (error) { next(error) }
}

export const score = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setId } = req.params as { setId: string }
    const { scorer } = req.body
    if (!scorer || !['us', 'opponent'].includes(scorer)) {
      res.status(400).json({ error: 'scorer must be "us" or "opponent"' })
      return
    }
    const clientEventId = typeof req.body?.clientEventId === 'string' ? req.body.clientEventId : undefined
    const result = await scorePoint(setId, req.user!.userId, scorer, clientEventId)
    res.status(200).json(result)
  } catch (error) { next(error) }
}

export const getState = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { matchId } = req.params as { matchId: string }
    const state = await getMatchState(matchId, req.user!.userId)
    res.status(200).json(state)
  } catch (error) { next(error) }
}

export const finishSet = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setId } = req.params as { setId: string }
    const result = await endSet(setId, req.user!.userId)
    res.status(200).json(result)
  } catch (error) { next(error) }
}

export const nextSet = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { matchId } = req.params as { matchId: string }
    const toss = parseToss(req.body?.servingTeam)
    if (toss === null) {
      res.status(400).json({ error: 'servingTeam must be "us" or "opponent"' })
      return
    }
    const result = await startNextSet(matchId, req.user!.userId, toss)
    res.status(201).json(result)
  } catch (error) { next(error) }
}

export const finish = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { matchId } = req.params as { matchId: string }
    const result = await endMatch(matchId, req.user!.userId)
    res.status(200).json(result)
  } catch (error) { next(error) }
}

export const getAll = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const matches = await getMatches(teamId, req.user!.userId)
    res.status(200).json(matches)
  } catch (error) { next(error) }
}

export const live = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { matchId } = req.params as { matchId: string }
    res.status(200).json(await getLiveSnapshot(matchId, req.user!.userId))
  } catch (error) { next(error) }
}

export const report = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { matchId } = req.params as { matchId: string }
    res.status(200).json(await getMatchReport(matchId, req.user!.userId))
  } catch (error) { next(error) }
}

export const opponentPlayers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { matchId } = req.params as { matchId: string }
    res.status(200).json(await listOpponentPlayers(matchId, req.user!.userId))
  } catch (error) { next(error) }
}

export const addOpponent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { matchId } = req.params as { matchId: string }
    const { jersey, name, position } = req.body ?? {}
    res.status(201).json(await addOpponentPlayer(matchId, req.user!.userId, { jersey: Number(jersey), name, position }))
  } catch (error) { next(error) }
}

export const removeOpponent = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { matchId, opponentPlayerId } = req.params as { matchId: string; opponentPlayerId: string }
    await removeOpponentPlayer(matchId, opponentPlayerId, req.user!.userId)
    res.status(204).send()
  } catch (error) { next(error) }
}
