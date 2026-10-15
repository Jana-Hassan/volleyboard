import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { create, getAll } from '../controllers/match.controller'

// Team-scoped match routes, mounted at /teams/:teamId/matches.
const router = Router({ mergeParams: true })
router.use(authenticate)

router.post('/', create)
router.get('/', getAll)

export default router
