import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { AuthPayload } from '../../types'

export interface AuthSocket extends Socket {
  user?: AuthPayload
}

export const socketAuthMiddleware = (
  socket: AuthSocket,
  next: (err?: Error) => void
): void => {
  try {
    const token = socket.handshake.auth.token

    if (!token) {
      return next(new Error('No token provided'))
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      return next(new Error('JWT_SECRET not configured'))
    }

    const payload = jwt.verify(token, secret) as AuthPayload
    socket.user = payload
    next()

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Token expired'))
    }
    return next(new Error('Invalid token'))
  }
}