import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import authRoutes from './routes/auth.routes'
import teamRoutes from './routes/team.routes'
import playerRoutes from './routes/player.routes'
import lineupRoutes from './routes/lineup.routes'
import matchRoutes from './routes/match.routes'
import teamMatchRoutes from './routes/team-match.routes'
import { errorHandler } from './middleware/error'
import { initializeSocket } from './socket/index'
import { registerMatchPublisher } from './socket/match.publisher'
import referenceRoutes from './routes/reference.routes'
import eventRoutes from './routes/event.routes'
import setRoutes from './routes/set.routes'


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
app.use('/api/v1/teams/:teamId/matches', teamMatchRoutes)
app.use('/api/v1/matches', matchRoutes)
app.use('/api/v1/reference', referenceRoutes)
app.use('/api/v1/sets/:setId/events', eventRoutes)
app.use('/api/v1/sets/:setId', setRoutes)

app.get('/health', (req, res) => { res.json({ status: 'ok', project: 'VolleyBoard' }) })

app.use(errorHandler)

initializeSocket(io)
registerMatchPublisher(io)

const PORT = process.env.PORT || 3000

httpServer.listen(PORT, () => {
  console.log(`VolleyBoard server running on port ${PORT}`)
})
