import prisma from '../lib/prisma'
import { VALID_ROLES, VALID_ROTATION_POSITIONS, MAX_LIBEROS } from '../lib/volleyball.constants'
import { requirePermission } from './team-access'

interface SlotInput {
  playerId: string
  role: string
  rotationPosition?: number | null
}

/**
 * Lineup composition (FIVB 7.3, 19.1): six starters in distinct positions 1-6,
 * at most two liberos who are never among the six, and a player registered as
 * libero only ever plays as libero (or sits the match out as reserved).
 */
export const validateLineupSlots = async (teamId: string, slots: SlotInput[], rotationSystem: string) => {
  for (const slot of slots) {
    if (!VALID_ROLES.includes(slot.role)) throw new Error('INVALID_ROLE')
  }

  const playerIds = slots.map(s => s.playerId)
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, teamId }
  })
  if (players.length !== playerIds.length) throw new Error('INVALID_PLAYERS')

  const playerById = new Map(players.map(p => [p.id, p]))
  const isLibero = (slot: SlotInput) => playerById.get(slot.playerId)!.isLibero

  const starters = slots.filter(s => s.role === 'starter')
  if (starters.some(isLibero)) throw new Error('LIBERO_AS_STARTER')
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

  const liberoSlots = slots.filter(s => s.role === 'libero')
  if (liberoSlots.some(s => !isLibero(s))) throw new Error('NOT_A_LIBERO')
  if (liberoSlots.length > MAX_LIBEROS) throw new Error('TOO_MANY_LIBEROS')
  if (slots.some(s => s.role === 'bench' && isLibero(s))) throw new Error('LIBERO_ON_BENCH')

  const setterCount = starters.filter(
    s => playerById.get(s.playerId)!.position.toLowerCase() === 'setter'
  ).length

  if (rotationSystem === '5-1' && setterCount !== 1) {
    throw new Error('INVALID_SETTER_COUNT_5_1')
  }
  if ((rotationSystem === '6-2' || rotationSystem === '4-2') && setterCount !== 2) {
    throw new Error('INVALID_SETTER_COUNT_6_2')
  }
}

// Only starters have a rotation position.
const slotData = (s: SlotInput) => ({
  playerId: s.playerId,
  role: s.role,
  rotationPosition: s.role === 'starter' ? s.rotationPosition ?? null : null
})

export const createLineup = async (
  teamId: string,
  userId: string,
  data: { name: string; rotationSystem: string; slots: SlotInput[] }
) => {
  await requirePermission(teamId, userId, 'lineup.edit')
  await validateLineupSlots(teamId, data.slots, data.rotationSystem)

  const lineup = await prisma.lineup.create({
    data: {
      teamId,
      name: data.name,
      rotationSystem: data.rotationSystem,
      lastEditedById: userId,
      slots: {
        create: data.slots.map(slotData)
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
  await requirePermission(teamId, userId, 'team.view')

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
  await requirePermission(teamId, userId, 'team.view')

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
  await requirePermission(teamId, userId, 'lineup.edit')

  const existing = await prisma.lineup.findFirst({
    where: { id: lineupId, teamId }
  })
  if (!existing) throw new Error('LINEUP_NOT_FOUND')

  const rotationSystem = data.rotationSystem ?? existing.rotationSystem

  if (data.slots) {
    await validateLineupSlots(teamId, data.slots, rotationSystem)
  }

  const lineup = await prisma.$transaction(async (tx) => {
    if (data.slots) {
      await tx.lineupSlot.deleteMany({ where: { lineupId } })
      await tx.lineupSlot.createMany({
        data: data.slots.map(s => ({ lineupId, ...slotData(s) }))
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
  await requirePermission(teamId, userId, 'lineup.edit')

  const lineup = await prisma.lineup.findFirst({
    where: { id: lineupId, teamId }
  })
  if (!lineup) throw new Error('LINEUP_NOT_FOUND')

  const matchCount = await prisma.match.count({ where: { lineupId } })
  if (matchCount > 0) throw new Error('LINEUP_IN_USE')

  await prisma.lineup.delete({ where: { id: lineupId } })
}