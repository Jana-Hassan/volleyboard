import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  start,
  score,
  getState,
  finishSet,
  nextSet,
  finish,
  live,
  report,
  opponentPlayers,
  addOpponent,
  removeOpponent
} from '../controllers/match.controller'


const router = Router()
router.use(authenticate)

router.post('/:matchId/start', start)
router.get('/:matchId/state', getState)
router.get('/:matchId/live', live)
router.get('/:matchId/report', report)
router.get('/:matchId/opponent-players', opponentPlayers)
router.post('/:matchId/opponent-players', addOpponent)
router.delete('/:matchId/opponent-players/:opponentPlayerId', removeOpponent)
router.post('/:matchId/next-set', nextSet)
router.post('/:matchId/end', finish)
router.post('/sets/:setId/point', score)
router.post('/sets/:setId/end', finishSet)

export default router
