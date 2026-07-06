import { Server } from 'socket.io'
import { AuthSocket } from './middleware/auth.socket'
import prisma from '../lib/prisma'

export const registerMatchHandlers = (io: Server, socket: AuthSocket): void => {
  socket.on('join_match', async ({ matchId }: { matchId: string }) => {
    try {
      if (!socket.user) {
        socket.emit('error', { message: 'Unauthorized' })
        return
      }

      const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
          team: {
            include: {
              members: true
            }
          },
          sets: {
            include: {
              rotations: {
                orderBy: { recordedAt: 'desc' },
                take: 1
              },
              substitutions: true,
              challenges: true,
              timeouts: true
            },
            orderBy: { setNumber: 'asc' }
          }
        }
      })

      if (!match) {
        socket.emit('error', { message: 'Match not found' })
        return
      }

      const isMember = match.team.members.some(
        m => m.userId === socket.user!.userId
      )

      if (!isMember) {
        socket.emit('error', { message: 'Forbidden' })
        return
      }

      const room = `match:${matchId}`
      socket.join(room)

      console.log(`${socket.user.email} joined match room: ${room}`)

      const activeSet = match.sets.find(s => s.status === 'active') ?? null
      const ourSetsWon = match.sets.filter(
        s => s.status === 'finished' && s.ourScore > s.opponentScore
      ).length
      const opponentSetsWon = match.sets.filter(
        s => s.status === 'finished' && s.opponentScore > s.ourScore
      ).length

      socket.emit('match_state', {
        matchId: match.id,
        status: match.status,
        ourSetsWon,
        opponentSetsWon,
        activeSet,
        currentPositions: activeSet?.rotations[0]?.positions ?? null
      })

    } catch (error) {
      console.error('join_match error:', error)
      socket.emit('error', { message: 'Failed to join match' })
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