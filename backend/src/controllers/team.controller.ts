import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types'
import {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  inviteMember,
  removeMember
} from '../services/team.service'

export const create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, logoUrl } = req.body
    if (!name) { res.status(400).json({ error: 'Team name is required' }); return }
    const team = await createTeam(req.user!.userId, name, logoUrl)
    res.status(201).json(team)
  } catch (error) { next(error) }
}

export const getAll = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const teams = await getTeams(req.user!.userId)
    res.status(200).json(teams)
  } catch (error) { next(error) }
}

export const getOne = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const team = await getTeamById(teamId, req.user!.userId)
    res.status(200).json(team)
  } catch (error) { next(error) }
}

export const update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const { name, logoUrl } = req.body
    const team = await updateTeam(teamId, req.user!.userId, { name, logoUrl })
    res.status(200).json(team)
  } catch (error) { next(error) }
}

export const remove = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    await deleteTeam(teamId, req.user!.userId)
    res.status(204).send()
  } catch (error) { next(error) }
}

export const invite = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const { email, role } = req.body
    if (!email) { res.status(400).json({ error: 'Email is required' }); return }
    const member = await inviteMember(teamId, req.user!.userId, email, role)
    res.status(201).json(member)
  } catch (error) { next(error) }
}

export const kickMember = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { teamId, memberId } = req.params as { teamId: string; memberId: string }
    await removeMember(teamId, req.user!.userId, memberId)
    res.status(204).send()
  } catch (error) { next(error) }
}