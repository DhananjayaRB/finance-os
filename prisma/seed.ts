import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import { DEFAULT_CATEGORIES } from "../src/lib/constants";
import { SEED_DATA } from "../src/lib/excel-import";
import { seedExcelTemplate } from "../src/lib/seed-excel-template";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Finance OS database...");

  await prisma.notification.deleteMany();
  await prisma.importHistory.deleteMany();
  await prisma.cashTransaction.deleteMany();
  await prisma.cashBox.deleteMany();
  await prisma.loanPayment.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.income.deleteMany();
  await prisma.fixedExpense.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.saving.deleteMany();
  await prisma.savingEntry.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.creditCard.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const pinHash = await bcrypt.hash(SEED_DATA.defaultPin, 12);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const user = await prisma.user.create({
    data: {
      name: "Finance User",
      email: "demo@financeos.app",
      mobile: "9876543210",
      pinHash,
      salaryDay: SEED_DATA.salaryDay,
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      name: "HDFC Savings",
      bankName: "HDFC Bank",
      balance: 52400,
      isPrimary: true,
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      name: "CANARA Savings",
      bankName: "Canara Bank",
      balance: 15000,
    },
  });

  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.create({
      data: {
        userId: user.id,
        name: cat.name,
        classification: cat.classification,
        icon: cat.icon,
        isDefault: true,
      },
    });
  }

  await seedExcelTemplate(user.id, month, year);

  for (const inv of SEED_DATA.investments) {
    await prisma.investment.create({ data: { userId: user.id, ...inv } });
  }

  for (const card of SEED_DATA.creditCards) {
    await prisma.creditCard.create({ data: { userId: user.id, ...card } });
  }

  for (const box of SEED_DATA.cashBoxes) {
    await prisma.cashBox.create({ data: { userId: user.id, ...box } });
  }

  for (const goal of SEED_DATA.goals) {
    await prisma.goal.create({ data: { userId: user.id, ...goal } });
  }

  const foodCat = await prisma.category.findFirst({
    where: { userId: user.id, name: "Swiggy" },
  });

  const sampleExpenses: {
    amount: number;
    merchant: string;
    classification: "WANT" | "NEED";
    categoryId?: string;
  }[] = [
    { amount: 350, merchant: "Swiggy", classification: "WANT", categoryId: foodCat?.id },
    { amount: 120, merchant: "Metro", classification: "NEED" as const },
    { amount: 2500, merchant: "Amazon", classification: "WANT" as const },
    { amount: 500, merchant: "Zepto", classification: "WANT" as const },
    { amount: 180, merchant: "Coffee", classification: "WANT" as const },
  ];

  for (const exp of sampleExpenses) {
    await prisma.expense.create({
      data: {
        userId: user.id,
        amount: exp.amount,
        merchant: exp.merchant,
        classification: exp.classification,
        categoryId: exp.categoryId,
        month,
        year,
        paymentMethod: "UPI",
      },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: user.id,
        type: "EMI_REMINDER",
        title: "EMI Due Tomorrow",
        message: "IDFC(2) EMI of ₹11,300 is due tomorrow",
        dueDate: new Date(year, now.getMonth(), 2),
      },
      {
        userId: user.id,
        type: "SIP_REMINDER",
        title: "SIP Reminder",
        message: "Mutual Fund SIP of ₹10,000 due on 7th",
        dueDate: new Date(year, now.getMonth(), 7),
      },
    ],
  });

  console.log("✅ Seed complete!");
  console.log(`   Login: demo@financeos.app or 9876543210`);
  console.log(`   Default PIN: ${SEED_DATA.defaultPin}`);
  console.log(`   User ID: ${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
