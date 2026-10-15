import { Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { hasPermission, Permission } from '../lib/permissions'

export type DbClient = Prisma.TransactionClient | typeof prisma


export const requirePermission = async (
  teamId: string,
  userId: string,
  permission: Permission,
  client: DbClient = prisma
): Promise<string> => {
  const member = await client.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } }
  })
  if (!member) throw new Error('FORBIDDEN')
  if (!hasPermission(member.role, permission)) throw new Error('FORBIDDEN')
  return member.role
}
