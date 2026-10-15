import { Response, NextFunction } from 'express'
import { AuthRequest } from '../types'
import { changeLibero } from '../services/libero.service'
import { substitutePlayers } from '../services/substitution.service'
import { callTimeout } from '../services/timeout.service'
import { callChallenge, resolveChallenge } from '../services/challenge.service'
import { CHALLENGE_TYPES } from '../lib/volleyball.constants'

const isTeam = (value: unknown): value is 'us' | 'opponent' => value === 'us' || value === 'opponent'

export const libero = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setId } = req.params as { setId: string }
    const { action, liberoId, replacedPlayerId } = req.body ?? {}

    if (action === 'in') {
      if (!liberoId || !replacedPlayerId) {
        res.status(400).json({ error: 'liberoId and replacedPlayerId are required to bring the libero in' })
        return
      }
      res.status(200).json(await changeLibero(setId, req.user!.userId, { action, liberoId, replacedPlayerId }))
      return
    }

    if (action === 'out') {
      res.status(200).json(await changeLibero(setId, req.user!.userId, { action }))
      return
    }

    res.status(400).json({ error: 'action must be "in" or "out"' })
  } catch (error) { next(error) }
}

const isSubRequest = (s: unknown): s is { playerOutId: string; playerInId: string } =>
  typeof s === 'object' && s !== null &&
  typeof (s as Record<string, unknown>).playerOutId === 'string' &&
  typeof (s as Record<string, unknown>).playerInId === 'string'

export const substitutions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setId } = req.params as { setId: string }
    const list: unknown = req.body?.substitutions
    if (!Array.isArray(list) || !list.every(isSubRequest)) {
      res.status(400).json({ error: 'substitutions must be a list of { playerOutId, playerInId }' })
      return
    }
    const requests = list.map(s => ({ playerOutId: s.playerOutId, playerInId: s.playerInId }))
    res.status(201).json(await substitutePlayers(setId, req.user!.userId, requests))
  } catch (error) { next(error) }
}

export const timeouts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setId } = req.params as { setId: string }
    const calledBy = req.body?.calledBy
    if (!isTeam(calledBy)) {
      res.status(400).json({ error: 'calledBy must be "us" or "opponent"' })
      return
    }
    res.status(201).json(await callTimeout(setId, req.user!.userId, calledBy))
  } catch (error) { next(error) }
}

export const challenges = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setId } = req.params as { setId: string }
    const { challenger, callType } = req.body ?? {}
    if (!isTeam(challenger)) {
      res.status(400).json({ error: 'challenger must be "us" or "opponent"' })
      return
    }
    if (!CHALLENGE_TYPES.includes(callType)) {
      res.status(400).json({ error: `callType must be one of: ${CHALLENGE_TYPES.join(', ')}` })
      return
    }
    res.status(201).json(await callChallenge(setId, req.user!.userId, { challenger, callType }))
  } catch (error) { next(error) }
}

export const resolve = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { setId, challengeId } = req.params as { setId: string; challengeId: string }
    const { successful, awardPoint } = req.body ?? {}
    if (typeof successful !== 'boolean' || (awardPoint !== undefined && typeof awardPoint !== 'boolean')) {
      res.status(400).json({ error: 'successful must be true or false; awardPoint, if sent, too' })
      return
    }
    res.status(200).json(await resolveChallenge(setId, challengeId, req.user!.userId, { successful, awardPoint: awardPoint ?? false }))
  } catch (error) { next(error) }
}
