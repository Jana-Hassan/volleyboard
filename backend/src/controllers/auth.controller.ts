import { Request, Response } from 'express'
import { registerUser, loginUser } from '../services/auth.service'
import { AuthRequest } from '../types'

export const register = async (req: Request, res: Response): Promise<void> => {
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

  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_TAKEN') {
      res.status(409).json({ error: 'Email already registered' })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' })
      return
    }

    const result = await loginUser({ email, password })
    res.status(200).json(result)

  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(200).json({ user: req.user })
}