import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { libero, substitutions, timeouts, challenges, resolve } from '../controllers/set.controller'

// Set-scoped actions, mounted at /sets/:setId.
const router = Router({ mergeParams: true })
router.use(authenticate)

router.post('/libero', libero)
router.post('/substitutions', substitutions)
router.post('/timeouts', timeouts)
router.post('/challenges', challenges)
router.post('/challenges/:challengeId/resolve', resolve)

export default router
