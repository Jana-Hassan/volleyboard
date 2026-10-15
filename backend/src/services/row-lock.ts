import { Prisma } from '@prisma/client'

export const lockSet = async (tx: Prisma.TransactionClient, setId: string): Promise<void> => {
  await tx.$queryRaw`SELECT id FROM "MatchSet" WHERE id = ${setId} FOR UPDATE`
}

export const lockMatch = async (tx: Prisma.TransactionClient, matchId: string): Promise<void> => {
  await tx.$queryRaw`SELECT id FROM "Match" WHERE id = ${matchId} FOR UPDATE`
}
