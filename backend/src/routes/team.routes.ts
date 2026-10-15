import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { create, getAll, getOne, update, remove, invite, kickMember } from '../controllers/team.controller'

const router = Router()

router.use(authenticate)

router.post('/', create)
router.get('/', getAll)
router.get('/:teamId', getOne)
router.put('/:teamId', update)
router.delete('/:teamId', remove)
router.post('/:teamId/invite', invite)
router.delete('/:teamId/members/:userId', kickMember)

export default router