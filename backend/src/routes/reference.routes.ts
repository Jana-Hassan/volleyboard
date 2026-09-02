import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import nationalTeams from '../data/national-teams.json'
import competitions from '../data/competitions.json'

const router = Router()
router.use(authenticate)

router.get('/teams', (req, res) => {
  res.json(nationalTeams)
})

router.get('/competitions', (req, res) => {
  res.json(competitions)
})

export default router