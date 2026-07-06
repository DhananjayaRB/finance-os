import { PrismaClient, Prisma } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/** Bump when Prisma schema changes (also triggers delegate re-check). */
const PRISMA_SCHEMA_VERSION = 6;

const REQUIRED_DELEGATES = [
  "savingEntry",
  "insurance",
  "accountTransaction",
] as const;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: pg.Pool | undefined;
  schemaVersion: number | undefined;
};

type PrismaDelegate = { findMany?: unknown; create?: unknown };

const DELEGATE_CHECKS: Record<(typeof REQUIRED_DELEGATES)[number], "findMany" | "create"> = {
  savingEntry: "findMany",
  insurance: "findMany",
  accountTransaction: "create",
};

function isPrismaClientStale(client: PrismaClient): boolean {
  const d = client as unknown as Record<string, PrismaDelegate | undefined>;
  const missingDelegate = REQUIRED_DELEGATES.some(
    (name) => typeof d[name]?.[DELEGATE_CHECKS[name]] !== "function"
  );

  const loanModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "Loan");
  const missingLoanFields = !loanModel?.fields.some((f) => f.name === "payableAmount");

  return missingDelegate || missingLoanFields;
}

function prismaStaleMessage(): string {
  return (
    "Database client is out of date. Stop the dev server, run `npm run db:push`, then `npm run dev` again."
  );
}

function createPrismaClient() {
  const pool =
    globalForPrisma.pool ??
    new pg.Pool({ connectionString: process.env.DATABASE_URL });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrismaClient(): PrismaClient {
  const versionMismatch = globalForPrisma.schemaVersion !== PRISMA_SCHEMA_VERSION;
  const delegateStale = globalForPrisma.prisma && isPrismaClientStale(globalForPrisma.prisma);

  if (globalForPrisma.prisma && (versionMismatch || delegateStale)) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = undefined;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.schemaVersion = PRISMA_SCHEMA_VERSION;

    if (isPrismaClientStale(globalForPrisma.prisma)) {
      throw new Error(prismaStaleMessage());
    }
  }

  return globalForPrisma.prisma;
}

/** Proxy ensures hot-reload always resolves a client with all current models. */
const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export { prisma };
export default prisma;
