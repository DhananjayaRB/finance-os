import { PrismaClient } from "../src/generated/prisma/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  for (const u of users) {
    const savings = await prisma.saving.findMany({ where: { userId: u.id } });
    const jul = await prisma.savingEntry.findMany({
      where: { userId: u.id, month: 7, year: 2026 },
    });
    const aug = await prisma.savingEntry.findMany({
      where: { userId: u.id, month: 8, year: 2026 },
    });
    console.log("---", u.name);
    console.log(
      "masters:",
      savings.map((s) => `${s.name}:${s.amount}:${s.paymentStatus}`).join(", ") || "(none)"
    );
    console.log(
      "jul:",
      jul.map((e) => `${e.name}:${e.amount}:${e.kind}:${e.paymentStatus}`).join(", ") || "(none)"
    );
    console.log(
      "aug:",
      aug.map((e) => `${e.name}:${e.amount}:${e.kind}:${e.paymentStatus}`).join(", ") || "(none)"
    );
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
