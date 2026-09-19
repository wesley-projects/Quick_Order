import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * SQLite by default so the app runs on a fresh clone with no database server.
 * To move to Postgres: change the datasource provider in schema.prisma and
 * swap this adapter for @prisma/adapter-pg — nothing else here changes.
 *
 * better-sqlite3 must stay out of the webpack bundle for its native binding to
 * load; see the externals list in next.config.mjs.
 */
function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
