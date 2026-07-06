import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { Redis } from 'ioredis'
import { socketAuthMiddleware, AuthSocket } from './middleware/auth.socket'
import { registerMatchHandlers } from './match.socket'

export const initializeSocket = (io: Server): void => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  const pubClient = new Redis(redisUrl)
  const subClient = pubClient.duplicate()

  pubClient.on('error', (err) => {
    console.error('Redis pub client error:', err)
  })

  subClient.on('error', (err) => {
    console.error('Redis sub client error:', err)
  })

  io.adapter(createAdapter(pubClient, subClient))
  console.log('Socket.io Redis adapter initialized')

  io.use(socketAuthMiddleware)

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`)
    registerMatchHandlers(io, socket as AuthSocket)
  })
}