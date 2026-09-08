import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export const useSocket = (matchId: string | undefined) => {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!matchId) return

    const token = localStorage.getItem('token')
    if (!token) return

    const socket = io('http://localhost:3000', {
      auth: { token }
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join_match', { matchId })
    })

    socket.on('disconnect', () => setConnected(false))

    return () => {
      socket.emit('leave_match', { matchId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [matchId])

  return { socket: socketRef.current, connected }
}
