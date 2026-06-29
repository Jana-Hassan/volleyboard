import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.routes'
import teamRoutes from './routes/team.routes'
import playerRoutes from './routes/player.routes'
import lineupRoutes from './routes/lineup.routes'


dotenv.config()

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
})

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/teams', teamRoutes)
app.use('/api/v1/teams/:teamId/players', playerRoutes)
app.use('/api/v1/teams/:teamId/lineups', lineupRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', project: 'VolleyBoard' })
})

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

const PORT = process.env.PORT || 3000

httpServer.listen(PORT, () => {
  console.log(`VolleyBoard server running on port ${PORT}`)
})

export { io }