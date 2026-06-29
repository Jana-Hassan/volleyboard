import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { create, getAll, getOne, update, remove } from '../controllers/lineup.controller'

const router = Router({ mergeParams: true })

router.use(authenticate)

router.post('/', create)
router.get('/', getAll)
router.get('/:lineupId', getOne)
router.put('/:lineupId', update)
router.delete('/:lineupId', remove)

export default router