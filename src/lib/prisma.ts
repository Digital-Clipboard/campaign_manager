/**
 * Singleton Prisma Client
 *
 * This ensures only ONE Prisma client instance is created across the entire application.
 * Multiple instances cause:
 * - Excessive memory usage (each client = ~20-30MB + connection pool)
 * - Connection pool exhaustion (each client maintains separate pool)
 * - Memory leaks on hot reloads in development
 *
 * Usage:
 *   import { prisma } from '@/lib/prisma';
 *   const users = await prisma.user.findMany();
 */

import { PrismaClient } from '@prisma/client';

// Extend global type to store Prisma instance
const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

// Create singleton Prisma client
export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  // Connection pool settings optimized for Heroku
  datasources: {
    db: {
      url: process.env.DATABASE_URL
        ? `${process.env.DATABASE_URL}?connection_limit=5&pool_timeout=20`
        : undefined
    }
  }
});

// In development, preserve Prisma client across hot reloads
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown - disconnect Prisma when process exits
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
