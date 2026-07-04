import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types'
import {
  createMatch,
  startMatch,
  scorePoint,
  getMatchState,
  endSet,
  startNextSet,
  endMatch
} from '../services/match.service'

export const create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const { lineupId, opponentName } = req.body
    if (!lineupId || !opponentName) {
      res.status(400).json({ error: 'lineupId and opponentName are required' })
      return
    }
    const match = await createMatch(teamId, req.user!.userId, { lineupId, opponentName })
    res.status(201).json(match)
  } catch (error) { next(error) }
}

export const start = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { matchId } = req.params as { matchId: string }
    const result = await startMatch(matchId, req.user!.userId)
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
    const result = await scorePoint(setId, req.user!.userId, scorer)
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
    const result = await startNextSet(matchId, req.user!.userId)
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