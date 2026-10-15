import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types'
import { addPlayer, getPlayers, updatePlayer, removePlayer } from '../services/player.service'
import { getPlayerProfile } from '../services/profile.service'

export const add = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const { name, number, position, isLibero } = req.body
    if (!name || !number || !position) {
      res.status(400).json({ error: 'Name, number and position are required' })
      return
    }
    const player = await addPlayer(teamId, req.user!.userId, { name, number, position, isLibero })
    res.status(201).json(player)
  } catch (error) { next(error) }
}

export const getAll = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const players = await getPlayers(teamId, req.user!.userId)
    res.status(200).json(players)
  } catch (error) { next(error) }
}

export const update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId, playerId } = req.params as { teamId: string; playerId: string }
    const player = await updatePlayer(teamId, playerId, req.user!.userId, req.body)
    res.status(200).json(player)
  } catch (error) { next(error) }
}

export const remove = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId, playerId } = req.params as { teamId: string; playerId: string }
    await removePlayer(teamId, playerId, req.user!.userId)
    res.status(204).send()
  } catch (error) { next(error) }
}
export const getOne = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId, playerId } = req.params as { teamId: string; playerId: string }
    res.status(200).json(await getPlayerProfile(teamId, playerId, req.user!.userId))
  } catch (error) { next(error) }
}
