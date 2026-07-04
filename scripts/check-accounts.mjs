import "dotenv/config";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
for (const u of users) {
  const accounts = await prisma.account.findMany({ where: { userId: u.id } });
  console.log(u.email || u.name, accounts.length, accounts.map((a) => `${a.name}=${a.balance} primary=${a.isPrimary}`));
}
await prisma.$disconnect();
await pool.end();
