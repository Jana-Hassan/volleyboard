import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {  //to not restart the server on every file save
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma