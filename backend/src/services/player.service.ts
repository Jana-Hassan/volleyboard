import prisma from '../lib/prisma'
import { requirePermission } from './team-access'

export const addPlayer = async (
  teamId: string,
  userId: string,
  data: {
    name: string
    number: string
    position: string
    isLibero?: boolean
  }
) => {
  await requirePermission(teamId, userId, 'roster.edit')

  const existing = await prisma.player.findFirst({
    where: { teamId, number: data.number }
  })

  if (existing) throw new Error('NUMBER_TAKEN')

  const player = await prisma.player.create({
    data: {
      teamId,
      name: data.name,
      number: data.number,
      position: data.position,
      isLibero: data.isLibero ?? false
    }
  })

  return player
}

export const getPlayers = async (teamId: string, userId: string) => {
  await requirePermission(teamId, userId, 'team.view')

  const players = await prisma.player.findMany({
    where: { teamId }
  })

  return players.sort((a, b) => parseInt(a.number) - parseInt(b.number))
}

export const updatePlayer = async (
  teamId: string,
  playerId: string,
  userId: string,
  data: {
    name?: string
    number?: string
    position?: string
    isLibero?: boolean
    isActive?: boolean
  }
) => {
  await requirePermission(teamId, userId, 'roster.edit')

  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId }
  })

  if (!player) throw new Error('PLAYER_NOT_FOUND')

  if (data.number && data.number !== player.number) {
    const existing = await prisma.player.findFirst({
      where: { teamId, number: data.number }
    })
    if (existing) throw new Error('NUMBER_TAKEN')
  }

  const updated = await prisma.player.update({
    where: { id: playerId },
    data
  })

  return updated
}

export const removePlayer = async (
  teamId: string,
  playerId: string,
  userId: string
) => {
  await requirePermission(teamId, userId, 'roster.edit')

  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId }
  })

  if (!player) throw new Error('PLAYER_NOT_FOUND')

  await prisma.player.delete({
    where: { id: playerId }
  })
}