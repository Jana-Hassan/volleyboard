import { Response } from 'express'
import { AuthRequest } from '../types'
import {
  createLineup,
  getLineups,
  getLineupById,
  updateLineup,
  deleteLineup
} from '../services/lineup.service'

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const { name, rotationSystem, slots } = req.body

    if (!name || !rotationSystem || !slots || !Array.isArray(slots)) {
      res.status(400).json({ error: 'Name, rotationSystem and slots are required' })
      return
    }

    const lineup = await createLineup(teamId, req.user!.userId, { name, rotationSystem, slots })
    res.status(201).json(lineup)
  } catch (error) {
    if (error instanceof Error) {
      const clientErrors: Record<string, string> = {
        FORBIDDEN: 'Only coaches and managers can create lineups',
        INVALID_PLAYERS: 'One or more players do not belong to this team',
        INVALID_ROLE: 'Invalid slot role. Must be starter, bench or reserved',
        INVALID_STARTER_COUNT: 'Lineup must have exactly 6 starters',
        INVALID_ROTATION_POSITION: 'Starters must have rotation positions 1-6',
        DUPLICATE_ROTATION_POSITION: 'Two starters cannot have the same rotation position',
        TOO_MANY_LIBEROS: 'Only one libero can be in the starting lineup'
      }
      if (clientErrors[error.message]) {
        res.status(400).json({ error: clientErrors[error.message] })
        return
      }
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getAll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const lineups = await getLineups(teamId, req.user!.userId)
    res.status(200).json(lineups)
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getOne = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId, lineupId } = req.params as { teamId: string, lineupId: string }
    const lineup = await getLineupById(teamId, lineupId, req.user!.userId)
    res.status(200).json(lineup)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      if (error.message === 'LINEUP_NOT_FOUND') {
        res.status(404).json({ error: 'Lineup not found' })
        return
      }
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const update = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId, lineupId } = req.params as { teamId: string, lineupId: string }
    const lineup = await updateLineup(teamId, lineupId, req.user!.userId, req.body)
    res.status(200).json(lineup)
  } catch (error) {
    if (error instanceof Error) {
      const clientErrors: Record<string, string> = {
        FORBIDDEN: 'Only coaches and managers can update lineups',
        LINEUP_NOT_FOUND: 'Lineup not found',
        INVALID_PLAYERS: 'One or more players do not belong to this team',
        INVALID_STARTER_COUNT: 'Lineup must have exactly 6 starters',
        DUPLICATE_ROTATION_POSITION: 'Two starters cannot have the same rotation position'
      }
      if (clientErrors[error.message]) {
        const status = error.message === 'LINEUP_NOT_FOUND' ? 404 :
                       error.message === 'FORBIDDEN' ? 403 : 400
        res.status(status).json({ error: clientErrors[error.message] })
        return
      }
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const remove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId, lineupId } = req.params as { teamId: string, lineupId: string }
    await deleteLineup(teamId, lineupId, req.user!.userId)
    res.status(204).send()
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      if (error.message === 'LINEUP_NOT_FOUND') {
        res.status(404).json({ error: 'Lineup not found' })
        return
      }
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}