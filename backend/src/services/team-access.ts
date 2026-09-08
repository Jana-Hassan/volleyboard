import prisma from '../lib/prisma'

/**
 * Team membership / role guards, shared by the services.
 *
 * These were previously duplicated across match.service and event.service.
 * Behaviour is unchanged: every guard throws Error('FORBIDDEN'), which the
 * error middleware maps to a 403.
 */

const requireRole = async (
  teamId: string,
  userId: string,
  roles?: string[]
): Promise<void> => {
  const member = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  })
  if (!member) throw new Error('FORBIDDEN')
  if (roles && !roles.includes(member.role)) throw new Error('FORBIDDEN')
}

export const checkMembership = (teamId: string, userId: string): Promise<void> =>
  requireRole(teamId, userId)

export const checkManagerOrAssistant = (teamId: string, userId: string): Promise<void> =>
  requireRole(teamId, userId, ['manager', 'assistant'])

export const checkCoachOrManager = (teamId: string, userId: string): Promise<void> =>
  requireRole(teamId, userId, ['manager', 'coach'])

export const checkAnalystOrCoach = (teamId: string, userId: string): Promise<void> =>
  requireRole(teamId, userId, ['manager', 'coach', 'analyst'])
