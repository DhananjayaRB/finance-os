import prisma from "@/lib/db";
import { EXCEL_PLAN_TEMPLATE } from "@/lib/excel-template";

export async function seedExcelTemplate(userId: string, month: number, year: number) {
  const t = EXCEL_PLAN_TEMPLATE;

  // Upsert loans
  for (const loan of t.loans) {
    const existing = await prisma.loan.findFirst({
      where: { userId, name: { equals: loan.name, mode: "insensitive" } },
    });
    const paymentStatus = loan.payableAmount > 0 ? "PENDING" : "PAID";
    const data = {
      emiAmount: loan.emiAmount,
      outstanding: loan.outstanding,
      pendingEmi: loan.pendingEmi,
      emiDate: loan.emiDate,
      interestRate: loan.interestRate,
      payableAmount: loan.payableAmount,
      paymentStatus: paymentStatus as "PAID" | "PENDING",
      loanType: loan.loanType,
      status: "ACTIVE" as const,
    };
    if (existing) {
      await prisma.loan.update({ where: { id: existing.id }, data });
    } else {
      await prisma.loan.create({ data: { userId, name: loan.name, ...data } });
    }
  }

  // Home expenses
  for (const fe of t.homeExpenses) {
    const existing = await prisma.fixedExpense.findFirst({
      where: { userId, name: fe.name, category: "HOME" },
    });
    const data = {
      amount: fe.amount,
      payableAmount: fe.payableAmount,
      paymentStatus: (fe.payableAmount > 0 ? "PENDING" : "PAID") as "PAID" | "PENDING",
      dueDay: fe.dueDay,
      category: "HOME",
    };
    if (existing) {
      await prisma.fixedExpense.update({ where: { id: existing.id }, data });
    } else {
      await prisma.fixedExpense.create({ data: { userId, name: fe.name, ...data } });
    }
  }

  // Monthly fixed expenses
  for (const fe of t.monthlyFixedExpenses) {
    const existing = await prisma.fixedExpense.findFirst({
      where: { userId, name: fe.name, category: "MONTHLY_FIXED" },
    });
    const data = { amount: fe.amount, category: "MONTHLY_FIXED", payableAmount: 0, paymentStatus: "PAID" as const };
    if (existing) {
      await prisma.fixedExpense.update({ where: { id: existing.id }, data });
    } else {
      await prisma.fixedExpense.create({ data: { userId, name: fe.name, ...data } });
    }
  }

  // Savings
  for (const sav of t.savings) {
    const existing = await prisma.saving.findFirst({ where: { userId, name: sav.name } });
    const data = {
      amount: sav.amount,
      payableAmount: sav.payableAmount,
      paymentStatus: (sav.payableAmount > 0 ? "PENDING" : "PAID") as "PAID" | "PENDING",
      type: sav.type,
    };
    if (existing) {
      await prisma.saving.update({ where: { id: existing.id }, data });
    } else {
      await prisma.saving.create({ data: { userId, name: sav.name, ...data } });
    }
  }

  // Income sources
  await prisma.income.deleteMany({ where: { userId, month, year } });
  for (const inc of t.incomeSources) {
    await prisma.income.create({
      data: {
        userId,
        source: inc.source,
        incomeType: inc.incomeType,
        amount: inc.amount,
        month,
        year,
        isRecurring: inc.isRecurring,
        isReceived: inc.incomeType !== "SALARY",
      },
    });
  }

  // Subscriptions
  for (const sub of t.subscriptions) {
    const existing = await prisma.subscription.findFirst({
      where: { userId, name: sub.name },
    });
    const data = {
      amount: sub.amount,
      renewalDay: sub.renewalDay,
      cycle: "MONTHLY" as const,
      autoDebit: true,
      isActive: true,
    };
    if (existing) {
      await prisma.subscription.update({ where: { id: existing.id }, data });
    } else {
      await prisma.subscription.create({ data: { userId, name: sub.name, ...data } });
    }
  }

  // Insurance
  for (const ins of t.insurances) {
    const existing = await prisma.insurance.findFirst({
      where: { userId, name: ins.name },
    });
    const data = {
      provider: ins.provider,
      insuranceType: ins.insuranceType,
      premium: ins.premium,
      coverageAmount: ins.coverageAmount,
      cycle: ins.cycle,
      renewalDay: ins.renewalDay,
      payableAmount: ins.payableAmount,
      paymentStatus: (ins.payableAmount > 0 ? "PENDING" : "PAID") as "PAID" | "PENDING",
      isActive: true,
    };
    if (existing) {
      await prisma.insurance.update({ where: { id: existing.id }, data });
    } else {
      await prisma.insurance.create({ data: { userId, name: ins.name, ...data } });
    }
  }

  // Budget
  await prisma.budget.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: { userId, month, year, ...t.budget },
    update: t.budget,
  });
}
