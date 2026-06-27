import { Request } from 'express'

export interface AuthPayload {
  userId: string
  email: string
}

export interface AuthRequest extends Request {
  user?: AuthPayload
}

export interface RegisterBody {
  name: string
  email: string
  password: string
}

export interface LoginBody {
  email: string
  password: string
}