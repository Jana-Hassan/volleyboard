import { Response } from 'express'
import { AuthRequest } from '../types'
import { addPlayer, getPlayers, updatePlayer, removePlayer } from '../services/player.service'

export const add = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const { name, number, position, isLibero } = req.body

    if (!name || !number || !position) {
      res.status(400).json({ error: 'Name, number and position are required' })
      return
    }

    const player = await addPlayer(teamId, req.user!.userId, { name, number, position, isLibero })
    res.status(201).json(player)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      if (error.message === 'NUMBER_TAKEN') {
        res.status(409).json({ error: 'Jersey number already taken' })
        return
      }
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getAll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const players = await getPlayers(teamId, req.user!.userId)
    res.status(200).json(players)
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const update = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId, playerId } = req.params as { teamId: string, playerId: string }
    const player = await updatePlayer(teamId, playerId, req.user!.userId, req.body)
    res.status(200).json(player)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      if (error.message === 'PLAYER_NOT_FOUND') {
        res.status(404).json({ error: 'Player not found' })
        return
      }
      if (error.message === 'NUMBER_TAKEN') {
        res.status(409).json({ error: 'Jersey number already taken' })
        return
      }
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const remove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId, playerId } = req.params as { teamId: string, playerId: string }
    await removePlayer(teamId, playerId, req.user!.userId)
    res.status(204).send()
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      if (error.message === 'PLAYER_NOT_FOUND') {
        res.status(404).json({ error: 'Player not found' })
        return
      }
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}