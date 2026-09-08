import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'

export type DbClient = Prisma.TransactionClient | typeof prisma

const requireRole = async (
  teamId: string,
  userId: string,
  roles: string[] | undefined,
  client: DbClient
): Promise<void> => {
  const member = await client.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  })
  if (!member) throw new Error('FORBIDDEN')
  if (roles && !roles.includes(member.role)) throw new Error('FORBIDDEN')
}

export const checkMembership = (
  teamId: string,
  userId: string,
  client: DbClient = prisma
): Promise<void> => requireRole(teamId, userId, undefined, client)

export const checkManagerOrAssistant = (
  teamId: string,
  userId: string,
  client: DbClient = prisma
): Promise<void> => requireRole(teamId, userId, ['manager', 'assistant'], client)

export const checkCoachOrManager = (
  teamId: string,
  userId: string,
  client: DbClient = prisma
): Promise<void> => requireRole(teamId, userId, ['manager', 'coach'], client)

export const checkAnalystOrCoach = (
  teamId: string,
  userId: string,
  client: DbClient = prisma
): Promise<void> => requireRole(teamId, userId, ['manager', 'coach', 'analyst'], client)
