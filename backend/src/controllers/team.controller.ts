import { Response } from 'express'
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

export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, logoUrl } = req.body
    if (!name) {
      res.status(400).json({ error: 'Team name is required' })
      return
    }
    const team = await createTeam(req.user!.userId, name, logoUrl)
    res.status(201).json(team)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getAll = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teams = await getTeams(req.user!.userId)
    res.status(200).json(teams)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getOne = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const team = await getTeamById(teamId, req.user!.userId)
    res.status(200).json(team)
  } catch (error) {
    if (error instanceof Error && error.message === 'TEAM_NOT_FOUND') {
      res.status(404).json({ error: 'Team not found' })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const update = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const { name, logoUrl } = req.body
    const team = await updateTeam(teamId, req.user!.userId, { name, logoUrl })
    res.status(200).json(team)
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const remove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    await deleteTeam(teamId, req.user!.userId)
    res.status(204).send()
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const invite = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId } = req.params as { teamId: string }
    const { email } = req.body
    if (!email) {
      res.status(400).json({ error: 'Email is required' })
      return
    }
    const member = await inviteMember(teamId, req.user!.userId, email)
    res.status(201).json(member)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FORBIDDEN') {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      if (error.message === 'USER_NOT_FOUND') {
        res.status(404).json({ error: 'No user found with that email' })
        return
      }
      if (error.message === 'ALREADY_MEMBER') {
        res.status(409).json({ error: 'User is already a team member' })
        return
      }
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const kickMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { teamId, memberId } = req.params as { teamId: string, memberId: string }
    await removeMember(teamId, req.user!.userId, memberId)
    res.status(204).send()
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}