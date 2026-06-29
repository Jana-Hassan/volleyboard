import prisma from '../lib/prisma'

const VALID_ROLES = ['starter', 'bench', 'reserved']
const VALID_ROTATION_POSITIONS = [1, 2, 3, 4, 5, 6]

const checkCoachOrManager = async (teamId: string, userId: string) => {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  })
  if (!member) throw new Error('FORBIDDEN')
  if (!['manager', 'coach'].includes(member.role)) throw new Error('FORBIDDEN')
}

const checkMembership = async (teamId: string, userId: string) => {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  })
  if (!member) throw new Error('FORBIDDEN')
}

export const createLineup = async (
  teamId: string,
  userId: string,
  data: {
    name: string
    rotationSystem: string
    slots: {
      playerId: string
      role: string
      rotationPosition?: number
    }[]
  }
) => {
  await checkCoachOrManager(teamId, userId)

  // validate all players belong to this team
  const playerIds = data.slots.map(s => s.playerId)
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, teamId }
  })

  if (players.length !== playerIds.length) {
    throw new Error('INVALID_PLAYERS')
  }

  // validate roles
  for (const slot of data.slots) {
    if (!VALID_ROLES.includes(slot.role)) {
      throw new Error('INVALID_ROLE')
    }
  }

  // validate starters have rotation positions 1-6
  const starters = data.slots.filter(s => s.role === 'starter')
  if (starters.length !== 6) throw new Error('INVALID_STARTER_COUNT')

  for (const starter of starters) {
    if (!starter.rotationPosition || !VALID_ROTATION_POSITIONS.includes(starter.rotationPosition)) {
      throw new Error('INVALID_ROTATION_POSITION')
    }
  }

  // validate no duplicate rotation positions
  const positions = starters.map(s => s.rotationPosition)
  const uniquePositions = new Set(positions)
  if (uniquePositions.size !== 6) throw new Error('DUPLICATE_ROTATION_POSITION')

  // validate only one libero in starters
  const starterPlayers = players.filter(p =>
    starters.some(s => s.playerId === p.id)
  )
  const liberoStarters = starterPlayers.filter(p => p.isLibero)
  if (liberoStarters.length > 1) throw new Error('TOO_MANY_LIBEROS')

  const lineup = await prisma.lineup.create({
    data: {
      teamId,
      name: data.name,
      rotationSystem: data.rotationSystem,
      slots: {
        create: data.slots.map(slot => ({
          playerId: slot.playerId,
          role: slot.role,
          rotationPosition: slot.role === 'starter' ? slot.rotationPosition : null
        }))
      }
    },
    include: {
      slots: {
        include: {
          player: true
        },
        orderBy: {
          rotationPosition: 'asc'
        }
      }
    }
  })

  return lineup
}

export const getLineups = async (teamId: string, userId: string) => {
  await checkMembership(teamId, userId)

  const lineups = await prisma.lineup.findMany({
    where: { teamId },
    include: {
      slots: {
        include: { player: true },
        orderBy: { rotationPosition: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return lineups
}

export const getLineupById = async (teamId: string, lineupId: string, userId: string) => {
  await checkMembership(teamId, userId)

  const lineup = await prisma.lineup.findFirst({
    where: { id: lineupId, teamId },
    include: {
      slots: {
        include: { player: true },
        orderBy: { rotationPosition: 'asc' }
      }
    }
  })

  if (!lineup) throw new Error('LINEUP_NOT_FOUND')
  return lineup
}

export const updateLineup = async (
  teamId: string,
  lineupId: string,
  userId: string,
  data: {
    name?: string
    rotationSystem?: string
    slots?: {
      playerId: string
      role: string
      rotationPosition?: number
    }[]
  }
) => {
  await checkCoachOrManager(teamId, userId)

  const lineup = await prisma.lineup.findFirst({
    where: { id: lineupId, teamId }
  })

  if (!lineup) throw new Error('LINEUP_NOT_FOUND')

  if (data.slots) {
    const playerIds = data.slots.map(s => s.playerId)
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds }, teamId }
    })

    if (players.length !== playerIds.length) throw new Error('INVALID_PLAYERS')

    const starters = data.slots.filter(s => s.role === 'starter')
    if (starters.length !== 6) throw new Error('INVALID_STARTER_COUNT')

    const positions = starters.map(s => s.rotationPosition)
    const uniquePositions = new Set(positions)
    if (uniquePositions.size !== 6) throw new Error('DUPLICATE_ROTATION_POSITION')

    // delete old slots and create new ones in a transaction
    await prisma.$transaction([
      prisma.lineupSlot.deleteMany({ where: { lineupId } }),
      prisma.lineup.update({
        where: { id: lineupId },
        data: {
          name: data.name ?? lineup.name,
          rotationSystem: data.rotationSystem ?? lineup.rotationSystem,
          slots: {
            create: data.slots.map(slot => ({
              playerId: slot.playerId,
              role: slot.role,
              rotationPosition: slot.role === 'starter' ? slot.rotationPosition : null
            }))
          }
        }
      })
    ])
  } else {
    await prisma.lineup.update({
      where: { id: lineupId },
      data: {
        name: data.name,
        rotationSystem: data.rotationSystem
      }
    })
  }

  return getLineupById(teamId, lineupId, userId)
}

export const deleteLineup = async (teamId: string, lineupId: string, userId: string) => {
  await checkCoachOrManager(teamId, userId)

  const lineup = await prisma.lineup.findFirst({
    where: { id: lineupId, teamId }
  })

  if (!lineup) throw new Error('LINEUP_NOT_FOUND')

  await prisma.lineup.delete({ where: { id: lineupId } })
}