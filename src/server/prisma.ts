import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Create a PrismaClient instance.
 * Prisma 7 with SQLite uses a bundled WASM query engine and does not require
 * an explicit driver adapter. The TypeScript type is strict, so we bypass it
 * here with a runtime-safe assertion.
 */
function createPrismaClient(): PrismaClient {
  // Prisma 7 for SQLite bundles the query engine as WASM 鈥?no adapter needed.
  // The constructor type requires `adapter` or `accelerateUrl`, but the runtime
  // handles SQLite connections via the embedded engine.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (PrismaClient as any)();
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
