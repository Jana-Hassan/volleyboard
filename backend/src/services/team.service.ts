import prisma from '../lib/prisma'
import { VALID_MEMBER_ROLES } from '../lib/volleyball.constants'
import { requirePermission } from './team-access'

export const createTeam = async (userId: string, name: string, logoUrl?: string) => {
  const team = await prisma.team.create({
    data: {
      name,
      logoUrl,
      members: {
        create: {
          userId,
          role: 'manager'
        }
      }
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }
    }
  })

  return team
}

export const getTeams = async (userId: string) => {
  const teams = await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId
        }
      }
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      },
      _count: {
        select: {
          players: true,
          matches: true
        }
      }
    }
  })

  return teams
}

export const getTeamById = async (teamId: string, userId: string) => {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      members: {
        some: { userId }
      }
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      },
      players: true,
      _count: {
        select: {
          players: true,
          matches: true,
          lineups: true
        }
      }
    }
  })

  if (!team) throw new Error('TEAM_NOT_FOUND')
  return team
}

export const updateTeam = async (teamId: string, userId: string, data: { name?: string, logoUrl?: string }) => {
  await requirePermission(teamId, userId, 'team.manage')

  const team = await prisma.team.update({
    where: { id: teamId },
    data
  })

  return team
}

export const deleteTeam = async (teamId: string, userId: string) => {
  await requirePermission(teamId, userId, 'team.manage')

  await prisma.team.delete({
    where: { id: teamId }
  })
}

export const inviteMember = async (
  teamId: string,
  userId: string,
  inviteeEmail: string,
  role: string = 'analyst'
) => {
  await requirePermission(teamId, userId, 'staff.manage')

  if (!VALID_MEMBER_ROLES.includes(role)) throw new Error('INVALID_ROLE')

  const invitee = await prisma.user.findUnique({
    where: { email: inviteeEmail }
  })

  if (!invitee) throw new Error('USER_NOT_FOUND')

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: invitee.id } }
  })

  if (existing) throw new Error('ALREADY_MEMBER')

  const newMember = await prisma.teamMember.create({
    data: {
      teamId,
      userId: invitee.id,
      role
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  })

  return newMember
}

export const removeMember = async (teamId: string, userId: string, targetUserId: string) => {
  await requirePermission(teamId, userId, 'staff.manage')

  const target = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUserId } }
  })
  if (!target) throw new Error('MEMBER_NOT_FOUND')

  if (target.role === 'manager') {
    const managers = await prisma.teamMember.count({ where: { teamId, role: 'manager' } })
    if (managers <= 1) throw new Error('LAST_MANAGER')
  }

  await prisma.teamMember.delete({
    where: { teamId_userId: { teamId, userId: targetUserId } }
  })
}
