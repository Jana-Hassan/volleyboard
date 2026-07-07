import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { log, getEvents, getLiveStats } from '../controllers/event.controller'

const router = Router({ mergeParams: true })
router.use(authenticate)

router.post('/', log)
router.get('/', getEvents)
router.get('/stats', getLiveStats)

export default router