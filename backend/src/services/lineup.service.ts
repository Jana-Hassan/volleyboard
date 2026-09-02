import prisma from '../lib/prisma'
import { VALID_ROLES, VALID_ROTATION_POSITIONS } from '../lib/volleyball.constants'

const checkCoachOrManager = async (teamId: string, userId: string): Promise<void> => {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  })
  if (!member) throw new Error('FORBIDDEN')
  if (!['manager', 'coach'].includes(member.role)) throw new Error('FORBIDDEN')
}

const checkMembership = async (teamId: string, userId: string): Promise<void> => {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  })
  if (!member) throw new Error('FORBIDDEN')
}

interface SlotInput {
  playerId: string
  role: string
  rotationPosition?: number | null
}

const validateSlots = async (teamId: string, slots: SlotInput[], rotationSystem: string) => {
  for (const slot of slots) {
    if (!VALID_ROLES.includes(slot.role)) throw new Error('INVALID_ROLE')
  }

  const playerIds = slots.map(s => s.playerId)
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, teamId }
  })
  if (players.length !== playerIds.length) throw new Error('INVALID_PLAYERS')

  const starters = slots.filter(s => s.role === 'starter')
  if (starters.length !== 6) throw new Error('INVALID_STARTER_COUNT')

  const positions = starters.map(s => s.rotationPosition)
  for (const pos of positions) {
    if (pos === null || pos === undefined || !VALID_ROTATION_POSITIONS.includes(pos)) {
      throw new Error('INVALID_ROTATION_POSITION')
    }
  }
  if (new Set(positions).size !== positions.length) {
    throw new Error('DUPLICATE_ROTATION_POSITION')
  }

  const starterPlayers = players.filter(p => starters.some(s => s.playerId === p.id))

  const liberoCount = starterPlayers.filter(p => p.isLibero).length
  if (liberoCount > 1) throw new Error('TOO_MANY_LIBEROS')

  const setterCount = starterPlayers.filter(
    p => p.position.toLowerCase() === 'setter'
  ).length

  if (rotationSystem === '5-1' && setterCount !== 1) {
    throw new Error('INVALID_SETTER_COUNT_5_1')
  }
  if ((rotationSystem === '6-2' || rotationSystem === '4-2') && setterCount !== 2) {
    throw new Error('INVALID_SETTER_COUNT_6_2')
  }
}

export const createLineup = async (
  teamId: string,
  userId: string,
  data: { name: string; rotationSystem: string; slots: SlotInput[] }
) => {
  await checkCoachOrManager(teamId, userId)
  await validateSlots(teamId, data.slots, data.rotationSystem)

  const lineup = await prisma.lineup.create({
    data: {
      teamId,
      name: data.name,
      rotationSystem: data.rotationSystem,
      lastEditedById: userId,
      slots: {
        create: data.slots.map(s => ({
          playerId: s.playerId,
          role: s.role,
          rotationPosition: s.rotationPosition ?? null
        }))
      }
    },
    include: {
      slots: { include: { player: true } },
      lastEditedBy: { select: { id: true, name: true } }
    }
  })

  return lineup
}

export const getLineups = async (teamId: string, userId: string) => {
  await checkMembership(teamId, userId)

  return prisma.lineup.findMany({
    where: { teamId },
    include: {
      slots: {
        include: { player: true },
        orderBy: { rotationPosition: 'asc' }
      },
      lastEditedBy: { select: { id: true, name: true } }
    },
    orderBy: { updatedAt: 'desc' }
  })
}

export const getLineupById = async (teamId: string, lineupId: string, userId: string) => {
  await checkMembership(teamId, userId)

  const lineup = await prisma.lineup.findFirst({
    where: { id: lineupId, teamId },
    include: {
      slots: {
        include: { player: true },
        orderBy: { rotationPosition: 'asc' }
      },
      lastEditedBy: { select: { id: true, name: true } }
    }
  })

  if (!lineup) throw new Error('LINEUP_NOT_FOUND')
  return lineup
}

export const updateLineup = async (
  teamId: string,
  lineupId: string,
  userId: string,
  data: { name?: string; rotationSystem?: string; slots?: SlotInput[] }
) => {
  await checkCoachOrManager(teamId, userId)

  const existing = await prisma.lineup.findFirst({
    where: { id: lineupId, teamId }
  })
  if (!existing) throw new Error('LINEUP_NOT_FOUND')

  const rotationSystem = data.rotationSystem ?? existing.rotationSystem

  if (data.slots) {
    await validateSlots(teamId, data.slots, rotationSystem)
  }

  const lineup = await prisma.$transaction(async (tx) => {
    if (data.slots) {
      await tx.lineupSlot.deleteMany({ where: { lineupId } })
      await tx.lineupSlot.createMany({
        data: data.slots.map(s => ({
          lineupId,
          playerId: s.playerId,
          role: s.role,
          rotationPosition: s.rotationPosition ?? null
        }))
      })
    }

    return tx.lineup.update({
      where: { id: lineupId },
      data: {
        name: data.name ?? existing.name,
        rotationSystem,
        lastEditedById: userId
      },
      include: {
        slots: {
          include: { player: true },
          orderBy: { rotationPosition: 'asc' }
        },
        lastEditedBy: { select: { id: true, name: true } }
      }
    })
  })

  return lineup
}

export const deleteLineup = async (teamId: string, lineupId: string, userId: string) => {
  await checkCoachOrManager(teamId, userId)

  const lineup = await prisma.lineup.findFirst({
    where: { id: lineupId, teamId }
  })
  if (!lineup) throw new Error('LINEUP_NOT_FOUND')

  const matchCount = await prisma.match.count({ where: { lineupId } })
  if (matchCount > 0) throw new Error('LINEUP_IN_USE')

  await prisma.lineup.delete({ where: { id: lineupId } })
}