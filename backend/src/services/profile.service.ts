import prisma from '../lib/prisma'
import { skillLine, StatEvent } from '../lib/stats'
import { requirePermission } from './team-access'

const PLAYING_ROLES = ['starter', 'bench', 'libero']

export const getPlayerProfile = async (teamId: string, playerId: string, userId: string) => {
  await requirePermission(teamId, userId, 'team.view')

  const player = await prisma.player.findFirst({ where: { id: playerId, teamId } })
  if (!player) throw new Error('PLAYER_NOT_FOUND')

  const [events, matches] = await Promise.all([
    prisma.matchEvent.findMany({
      where: { playerId, team: 'us', set: { match: { teamId } } },
      include: { set: { select: { matchId: true } } }
    }),
    prisma.match.findMany({
      where: { teamId },
      include: {
        sets: { select: { status: true, ourScore: true, opponentScore: true } },
        lineup: { include: { slots: { where: { playerId } } } }
      },
      orderBy: [{ scheduledAt: 'desc' }, { startedAt: 'desc' }]
    })
  ])

  const toStat = (e: typeof events[number]): StatEvent => ({
    id: e.id, team: e.team, eventType: e.eventType, outcome: e.outcome,
    playerId: e.playerId, playerName: player.name, rotation: e.rotation, payload: e.payload
  })

  const roleIn = (m: typeof matches[number]) => m.lineup.slots[0]?.role ?? null

  const played = matches
    .filter(m => m.status !== 'pending')
    .map(m => {
      const mine = events.filter(e => e.set.matchId === m.id).map(toStat)
      const finished = m.sets.filter(s => s.status === 'finished')
      return {
        matchId: m.id,
        opponentName: m.opponentName,
        competition: m.competition,
        date: m.scheduledAt ?? m.startedAt,
        status: m.status,
        role: roleIn(m),
        ourSetsWon: finished.filter(s => s.ourScore > s.opponentScore).length,
        opponentSetsWon: finished.filter(s => s.opponentScore > s.ourScore).length,
        stats: skillLine(mine),
        actions: mine.length
      }
    })
    .filter(m => m.actions > 0 || (m.role !== null && PLAYING_ROLES.includes(m.role)))

  const upcoming = matches
    .filter(m => m.status === 'pending' && roleIn(m) !== null && PLAYING_ROLES.includes(roleIn(m)!))
    .map(m => ({ matchId: m.id, opponentName: m.opponentName, competition: m.competition, scheduledAt: m.scheduledAt, role: roleIn(m) }))
    .reverse()

  return {
    player,
    totals: { matches: played.length, ...skillLine(events.map(toStat)) },
    matches: played,
    upcoming
  }
}
