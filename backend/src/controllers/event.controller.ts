import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types'
import { logEvent, getSetEvents, getLiveStatsForSet } from '../services/event.service'

export const log = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setId } = req.params as { setId: string }
    const { team, eventType, outcome, playerId, opponentPlayerId, rotation } = req.body

    if (!team || !eventType || !outcome) {
      res.status(400).json({ error: 'team, eventType and outcome are required' })
      return
    }

    if (!['us', 'opponent'].includes(team)) {
      res.status(400).json({ error: 'team must be "us" or "opponent"' })
      return
    }

    const result = await logEvent(setId, req.user!.userId, {
      team,
      eventType,
      outcome,
      playerId,
      opponentPlayerId,
      rotation
    })

    res.status(201).json(result)
  } catch (error) { next(error) }
}

export const getEvents = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setId } = req.params as { setId: string }
    const events = await getSetEvents(setId, req.user!.userId)
    res.status(200).json(events)
  } catch (error) { next(error) }
}

export const getLiveStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setId } = req.params as { setId: string }

    const stats = await getLiveStatsForSet(setId, req.user!.userId)
    res.status(200).json(stats)
  } catch (error) { next(error) }
}