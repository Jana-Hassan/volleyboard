import { Request, Response, NextFunction } from 'express'
import { registerUser, loginUser } from '../services/auth.service'
import { AuthRequest } from '../types'

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email and password are required' })
      return
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }
    const result = await registerUser({ name, email, password })
    res.status(201).json(result)
  } catch (error) { next(error) }
}

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }
    const result = await loginUser({ email, password })
    res.status(200).json(result)
  } catch (error) { next(error) }
}

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({ user: req.user })
  } catch (error) { next(error) }
}