import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types'
import {
  createLineup,
  getLineups,
  getLineupById,
  updateLineup,
  deleteLineup
} from '../services/lineup.service'

export const create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const { name, rotationSystem, slots } = req.body
    if (!name || !rotationSystem || !slots || !Array.isArray(slots)) {
      res.status(400).json({ error: 'Name, rotationSystem and slots are required' })
      return
    }
    const lineup = await createLineup(teamId, req.user!.userId, { name, rotationSystem, slots })
    res.status(201).json(lineup)
  } catch (error) { next(error) }
}

export const getAll = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const lineups = await getLineups(teamId, req.user!.userId)
    res.status(200).json(lineups)
  } catch (error) { next(error) }
}

export const getOne = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId, lineupId } = req.params as { teamId: string; lineupId: string }
    const lineup = await getLineupById(teamId, lineupId, req.user!.userId)
    res.status(200).json(lineup)
  } catch (error) { next(error) }
}

export const update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId, lineupId } = req.params as { teamId: string; lineupId: string }
    const lineup = await updateLineup(teamId, lineupId, req.user!.userId, req.body)
    res.status(200).json(lineup)
  } catch (error) { next(error) }
}

export const remove = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId, lineupId } = req.params as { teamId: string; lineupId: string }
    await deleteLineup(teamId, lineupId, req.user!.userId)
    res.status(204).send()
  } catch (error) { next(error) }
}