import { Server } from 'socket.io'
import { AuthSocket } from './middleware/auth.socket'
import { assertMatchViewer, getLiveSnapshot } from '../services/live.service'

const SOCKET_ERRORS: Record<string, string> = {
  MATCH_NOT_FOUND: 'Match not found',
  FORBIDDEN: 'Forbidden'
}

export const registerMatchHandlers = (io: Server, socket: AuthSocket): void => {
  socket.on('join_match', async ({ matchId }: { matchId: string }) => {
    try {
      if (!socket.user) {
        socket.emit('error', { message: 'Unauthorized' })
        return
      }

      await assertMatchViewer(matchId, socket.user.userId)

      const room = `match:${matchId}`
      socket.join(room)
      console.log(`${socket.user.email} joined match room: ${room}`)

      socket.emit('match_state', await getLiveSnapshot(matchId, socket.user.userId))
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      if (!SOCKET_ERRORS[code]) console.error('join_match error:', error)
      socket.emit('error', { message: SOCKET_ERRORS[code] ?? 'Failed to join match' })
    }
  })

  socket.on('leave_match', ({ matchId }: { matchId: string }) => {
    const room = `match:${matchId}`
    socket.leave(room)
    console.log(`${socket.user?.email} left match room: ${room}`)
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
}
