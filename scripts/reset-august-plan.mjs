import { PrismaClient } from "../src/generated/prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  console.log(`Resetting Aug 2026 plan payments for ${users.length} user(s)...`);

  for (const user of users) {
    const deleted = await prisma.planMonthPayment.deleteMany({
      where: { userId: user.id, month: 8, year: 2026 },
    });
    console.log(`  ${user.name}: cleared ${deleted.count} Aug 2026 payment row(s)`);
  }

  console.log("Done. Open Aug 2026 in Monthly Plan to auto-create fresh Pending rows.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
