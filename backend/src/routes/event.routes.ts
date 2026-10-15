import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { log, getEvents, getLiveStats, undoLast } from '../controllers/event.controller'

const router = Router({ mergeParams: true })
router.use(authenticate)

router.post('/', log)
router.get('/', getEvents)
router.get('/stats', getLiveStats)
router.delete('/last', undoLast)

export default router