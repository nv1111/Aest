import { PrismaClient } from '@prisma/client'

// TARA_DATABASE_URL wins over DATABASE_URL: the sandbox shell injects a stale
// SQLite DATABASE_URL on every new command; the app must always use the live
// Supabase Postgres URL from .env / hosting config instead.
const datasourceUrl = process.env.TARA_DATABASE_URL ?? process.env.DATABASE_URL

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    ...(datasourceUrl ? { datasourceUrl } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db