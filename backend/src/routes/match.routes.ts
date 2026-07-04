import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  create,
  start,
  score,
  getState,
  finishSet,
  nextSet,
  finish
} from '../controllers/match.controller'

const router = Router({ mergeParams: true })
router.use(authenticate)

router.post('/', create)
router.post('/:matchId/start', start)
router.get('/:matchId/state', getState)
router.post('/:matchId/next-set', nextSet)
router.post('/:matchId/end', finish)
router.post('/sets/:setId/point', score)
router.post('/sets/:setId/end', finishSet)

export default router