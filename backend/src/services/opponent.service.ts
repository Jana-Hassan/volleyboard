import prisma from '../lib/prisma'
import { requirePermission } from './team-access'
import { publish } from '../events/event-bus'
import { OPPONENT_ROSTER_CHANGED } from '../events/domain-events'

const matchTeam = async (matchId: string) => {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { teamId: true } })
  if (!match) throw new Error('MATCH_NOT_FOUND')
  return match.teamId
}

const roster = (matchId: string) =>
  prisma.opponentPlayer.findMany({ where: { matchId }, orderBy: { jersey: 'asc' } })

export const listOpponentPlayers = async (matchId: string, userId: string) => {
  await requirePermission(await matchTeam(matchId), userId, 'team.view')
  return roster(matchId)
}

export const addOpponentPlayer = async (
  matchId: string,
  userId: string,
  data: { jersey: number; name?: string; position?: string }
) => {
  await requirePermission(await matchTeam(matchId), userId, 'match.scout')
  if (!Number.isInteger(data.jersey) || data.jersey < 1 || data.jersey > 99) throw new Error('INVALID_JERSEY')

  const taken = await prisma.opponentPlayer.findFirst({ where: { matchId, jersey: data.jersey } })
  if (taken) throw new Error('OPPONENT_JERSEY_TAKEN')

  const player = await prisma.opponentPlayer.create({
    data: { matchId, jersey: data.jersey, name: data.name?.trim() || null, position: data.position?.trim() || null }
  })
  publish(OPPONENT_ROSTER_CHANGED, matchId, { matchId })
  return player
}

export const removeOpponentPlayer = async (matchId: string, opponentPlayerId: string, userId: string) => {
  await requirePermission(await matchTeam(matchId), userId, 'match.scout')

  const player = await prisma.opponentPlayer.findFirst({ where: { id: opponentPlayerId, matchId } })
  if (!player) throw new Error('OPPONENT_PLAYER_NOT_FOUND')

  const coded = await prisma.matchEvent.count({ where: { opponentPlayerId } })
  if (coded > 0) throw new Error('OPPONENT_PLAYER_HAS_EVENTS')

  await prisma.opponentPlayer.delete({ where: { id: opponentPlayerId } })
  publish(OPPONENT_ROSTER_CHANGED, matchId, { matchId })
}
