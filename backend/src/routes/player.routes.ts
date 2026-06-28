import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { add, getAll, update, remove } from '../controllers/player.controller'

const router = Router({ mergeParams: true })

router.use(authenticate)

router.post('/', add)
router.get('/', getAll)
router.put('/:playerId', update)
router.delete('/:playerId', remove)

export default router