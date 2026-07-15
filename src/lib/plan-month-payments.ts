import prisma from "@/lib/db";
import { decimalToNumber } from "@/lib/utils";
import { insuranceMonthlyAmount } from "@/lib/account-ledger";
import type { PlanPaymentSourceType, PaymentStatus } from "@/generated/prisma/client";

export type MonthPaymentKey = `${PlanPaymentSourceType}:${string}`;

export function monthPaymentKey(
  sourceType: PlanPaymentSourceType,
  sourceId: string
): MonthPaymentKey {
  return `${sourceType}:${sourceId}`;
}

export function planItemTypeToSourceType(
  type: string
): PlanPaymentSourceType | null {
  switch (type) {
    case "loan":
      return "LOAN";
    case "home":
      return "HOME";
    case "monthly_fixed":
      return "MONTHLY_FIXED";
    case "subscription":
      return "SUBSCRIPTION";
    case "insurance":
      return "INSURANCE";
    case "saving":
      return "SAVING";
    default:
      return null;
  }
}

export function planPayableTypeToSourceType(
  type: "loan" | "home" | "saving" | "insurance" | "subscription"
): PlanPaymentSourceType {
  switch (type) {
    case "loan":
      return "LOAN";
    case "home":
      return "HOME";
    case "saving":
      return "SAVING";
    case "insurance":
      return "INSURANCE";
    case "subscription":
      return "SUBSCRIPTION";
  }
}

function isFutureMonth(month: number, year: number, now = new Date()) {
  const curMonth = now.getMonth() + 1;
  const curYear = now.getFullYear();
  return year > curYear || (year === curYear && month > curMonth);
}

function defaultPayableFromTemplate(
  amount: number,
  storedPayable: number,
  storedStatus: PaymentStatus
): { payableAmount: number; paymentStatus: PaymentStatus } {
  if (storedStatus === "PAID" || storedPayable <= 0) {
    return { payableAmount: 0, paymentStatus: "PAID" };
  }
  const payableAmount = storedPayable > 0 ? storedPayable : amount;
  return { payableAmount, paymentStatus: storedStatus };
}

function freshMonthDefaults(amount: number): {
  payableAmount: number;
  paymentStatus: PaymentStatus;
} {
  if (amount <= 0) {
    return { payableAmount: 0, paymentStatus: "PAID" };
  }
  return { payableAmount: amount, paymentStatus: "PENDING" };
}

function defaultsForSource(
  sourceType: PlanPaymentSourceType,
  amount: number,
  storedPayable: number,
  storedStatus: PaymentStatus,
  future: boolean
): { payableAmount: number; paymentStatus: PaymentStatus } {
  if (sourceType === "MONTHLY_FIXED") {
    return { payableAmount: 0, paymentStatus: "PAID" };
  }
  if (future) return freshMonthDefaults(amount);
  return defaultPayableFromTemplate(amount, storedPayable, storedStatus);
}

interface TemplateItem {
  sourceType: PlanPaymentSourceType;
  sourceId: string;
  amount: number;
  payableAmount: number;
  paymentStatus: PaymentStatus;
}

async function loadTemplateItems(userId: string): Promise<TemplateItem[]> {
  const [loans, homeExpenses, monthlyFixed, subscriptions, insurances, savings] =
    await Promise.all([
      prisma.loan.findMany({ where: { userId, status: { not: "CLOSED" } } }),
      prisma.fixedExpense.findMany({
        where: { userId, OR: [{ category: "HOME" }, { category: null }] },
      }),
      prisma.fixedExpense.findMany({ where: { userId, category: "MONTHLY_FIXED" } }),
      prisma.subscription.findMany({ where: { userId, isActive: true } }),
      prisma.insurance.findMany({ where: { userId, isActive: true } }),
      prisma.saving.findMany({ where: { userId } }),
    ]);

  const items: TemplateItem[] = [];

  for (const loan of loans) {
    const amount = decimalToNumber(loan.emiAmount);
    items.push({
      sourceType: "LOAN",
      sourceId: loan.id,
      amount,
      payableAmount: decimalToNumber(loan.payableAmount),
      paymentStatus: loan.paymentStatus,
    });
  }

  for (const fe of homeExpenses) {
    const amount = decimalToNumber(fe.amount);
    items.push({
      sourceType: "HOME",
      sourceId: fe.id,
      amount,
      payableAmount: decimalToNumber(fe.payableAmount),
      paymentStatus: fe.paymentStatus,
    });
  }

  for (const fe of monthlyFixed) {
    const amount = decimalToNumber(fe.amount);
    items.push({
      sourceType: "MONTHLY_FIXED",
      sourceId: fe.id,
      amount,
      payableAmount: decimalToNumber(fe.payableAmount),
      paymentStatus: fe.paymentStatus,
    });
  }

  for (const sub of subscriptions) {
    const amount = decimalToNumber(sub.amount);
    items.push({
      sourceType: "SUBSCRIPTION",
      sourceId: sub.id,
      amount,
      payableAmount: decimalToNumber(sub.payableAmount),
      paymentStatus: sub.paymentStatus,
    });
  }

  for (const ins of insurances) {
    const amount = insuranceMonthlyAmount(
      decimalToNumber(ins.premium),
      ins.cycle
    );
    items.push({
      sourceType: "INSURANCE",
      sourceId: ins.id,
      amount,
      payableAmount: decimalToNumber(ins.payableAmount),
      paymentStatus: ins.paymentStatus,
    });
  }

  for (const saving of savings) {
    const amount = decimalToNumber(saving.amount);
    items.push({
      sourceType: "SAVING",
      sourceId: saving.id,
      amount,
      payableAmount: decimalToNumber(saving.payableAmount),
      paymentStatus: saving.paymentStatus,
    });
  }

  return items;
}

export async function getMonthPaymentMap(userId: string, month: number, year: number) {
  const rows = await prisma.planMonthPayment.findMany({
    where: { userId, month, year },
  });
  const map = new Map<MonthPaymentKey, (typeof rows)[number]>();
  for (const row of rows) {
    map.set(monthPaymentKey(row.sourceType, row.sourceId), row);
  }
  return map;
}

/** Ensure every template item has a month-scoped payment row. */
export async function ensureMonthPlanPayments(
  userId: string,
  month: number,
  year: number,
  options?: { reset?: boolean }
) {
  const templates = await loadTemplateItems(userId);
  const existing = await getMonthPaymentMap(userId, month, year);
  const future = isFutureMonth(month, year);
  const reset = options?.reset === true;

  for (const tpl of templates) {
    const key = monthPaymentKey(tpl.sourceType, tpl.sourceId);
    const row = existing.get(key);

    if (reset && row) {
      const defaults = defaultsForSource(
        tpl.sourceType,
        tpl.amount,
        tpl.payableAmount,
        tpl.paymentStatus,
        true
      );
      await prisma.planMonthPayment.update({
        where: { id: row.id },
        data: {
          amount: tpl.amount,
          payableAmount: defaults.payableAmount,
          paymentStatus: defaults.paymentStatus,
        },
      });
      continue;
    }

    if (row) {
      if (decimalToNumber(row.amount) !== tpl.amount) {
        const payable = decimalToNumber(row.payableAmount);
        const wasPaid = row.paymentStatus === "PAID" || payable <= 0;
        await prisma.planMonthPayment.update({
          where: { id: row.id },
          data: {
            amount: tpl.amount,
            ...(!wasPaid && payable > tpl.amount ? { payableAmount: tpl.amount } : {}),
          },
        });
      }
      continue;
    }

    const defaults = defaultsForSource(
      tpl.sourceType,
      tpl.amount,
      tpl.payableAmount,
      tpl.paymentStatus,
      future
    );

    await prisma.planMonthPayment.create({
      data: {
        userId,
        month,
        year,
        sourceType: tpl.sourceType,
        sourceId: tpl.sourceId,
        amount: tpl.amount,
        payableAmount: defaults.payableAmount,
        paymentStatus: defaults.paymentStatus,
      },
    });
  }
}

/** Wipe and recreate month payment rows with fresh defaults for that month. */
export async function resetMonthPlanPayments(userId: string, month: number, year: number) {
  const templates = await loadTemplateItems(userId);
  await prisma.planMonthPayment.deleteMany({ where: { userId, month, year } });

  for (const tpl of templates) {
    const defaults = defaultsForSource(
      tpl.sourceType,
      tpl.amount,
      tpl.payableAmount,
      tpl.paymentStatus,
      true
    );
    await prisma.planMonthPayment.create({
      data: {
        userId,
        month,
        year,
        sourceType: tpl.sourceType,
        sourceId: tpl.sourceId,
        amount: tpl.amount,
        payableAmount: defaults.payableAmount,
        paymentStatus: defaults.paymentStatus,
      },
    });
  }
}

export async function getMonthPaymentForItem(
  userId: string,
  month: number,
  year: number,
  sourceType: PlanPaymentSourceType,
  sourceId: string
) {
  await ensureMonthPlanPayments(userId, month, year);
  return prisma.planMonthPayment.findUnique({
    where: {
      userId_month_year_sourceType_sourceId: {
        userId,
        month,
        year,
        sourceType,
        sourceId,
      },
    },
  });
}

export async function updateMonthPayment(
  userId: string,
  month: number,
  year: number,
  sourceType: PlanPaymentSourceType,
  sourceId: string,
  data: {
    amount?: number;
    payableAmount?: number;
    paymentStatus?: PaymentStatus;
  }
) {
  const row = await getMonthPaymentForItem(userId, month, year, sourceType, sourceId);
  if (!row) return null;

  let payableAmount =
    data.payableAmount !== undefined ? data.payableAmount : decimalToNumber(row.payableAmount);
  let paymentStatus =
    data.paymentStatus !== undefined ? data.paymentStatus : row.paymentStatus;

  if (paymentStatus === "PAID") payableAmount = 0;
  else if (payableAmount <= 0 && (data.amount ?? decimalToNumber(row.amount)) > 0) {
    payableAmount = data.amount ?? decimalToNumber(row.amount);
  }

  return prisma.planMonthPayment.update({
    where: { id: row.id },
    data: {
      ...(data.amount !== undefined && { amount: data.amount }),
      payableAmount,
      paymentStatus,
    },
  });
}

export async function createMonthPaymentForNewItem(
  userId: string,
  month: number,
  year: number,
  sourceType: PlanPaymentSourceType,
  sourceId: string,
  amount: number,
  payableAmount?: number,
  paymentStatus?: PaymentStatus
) {
  const defaults = freshMonthDefaults(amount);
  return prisma.planMonthPayment.upsert({
    where: {
      userId_month_year_sourceType_sourceId: {
        userId,
        month,
        year,
        sourceType,
        sourceId,
      },
    },
    create: {
      userId,
      month,
      year,
      sourceType,
      sourceId,
      amount,
      payableAmount: payableAmount ?? defaults.payableAmount,
      paymentStatus: paymentStatus ?? defaults.paymentStatus,
    },
    update: {
      amount,
      ...(payableAmount !== undefined && { payableAmount }),
      ...(paymentStatus !== undefined && { paymentStatus }),
    },
  });
}

export async function deleteMonthPaymentsForSource(userId: string, sourceId: string) {
  await prisma.planMonthPayment.deleteMany({ where: { userId, sourceId } });
}

export async function copyIncomeToMonth(
  userId: string,
  fromMonth: number,
  fromYear: number,
  toMonth: number,
  toYear: number
) {
  const existing = await prisma.income.count({ where: { userId, month: toMonth, year: toYear } });
  if (existing > 0) return;

  const incomes = await prisma.income.findMany({
    where: { userId, month: fromMonth, year: fromYear },
  });

  for (const inc of incomes) {
    await prisma.income.create({
      data: {
        userId,
        source: inc.source,
        amount: inc.amount,
        incomeType: inc.incomeType,
        isReceived: false,
        month: toMonth,
        year: toYear,
        date: new Date(toYear, toMonth - 1, 1),
        isRecurring: inc.isRecurring,
      },
    });
  }
}

/**
 * Copy savings plan into a month as Pending/Payable from previous month's deposits.
 * (Saving master goals still show separately via PlanMonthPayment.)
 */
export async function ensureMonthSavingsPlan(
  userId: string,
  month: number,
  year: number,
  options?: { force?: boolean; fromMonth?: number; fromYear?: number }
) {
  const force = options?.force === true;
  const existingCount = await prisma.savingEntry.count({
    where: { userId, month, year },
  });

  if (existingCount > 0 && !force) return;

  if (force) {
    await prisma.savingEntry.deleteMany({ where: { userId, month, year } });
  }

  let fromMonth = options?.fromMonth;
  let fromYear = options?.fromYear;
  if (fromMonth === undefined || fromYear === undefined) {
    fromMonth = month - 1;
    fromYear = year;
    if (fromMonth <= 0) {
      fromMonth = 12;
      fromYear -= 1;
    }
  }

  const prevEntries = await prisma.savingEntry.findMany({
    where: {
      userId,
      month: fromMonth,
      year: fromYear,
      kind: { in: ["DEPOSIT", "MISSED"] },
    },
    orderBy: { date: "asc" },
  });

  // Deduplicate by name+type — keep largest planned amount as the monthly target
  const byKey = new Map<string, (typeof prevEntries)[number]>();
  for (const entry of prevEntries) {
    const amount = decimalToNumber(entry.amount);
    if (amount <= 0) continue;
    const key = `${entry.name}::${entry.type}`;
    const existing = byKey.get(key);
    if (!existing || amount > decimalToNumber(existing.amount)) {
      byKey.set(key, entry);
    }
  }

  if (byKey.size > 0) {
    for (const entry of byKey.values()) {
      const amount = decimalToNumber(entry.amount);
      await prisma.savingEntry.create({
        data: {
          userId,
          name: entry.name,
          type: entry.type,
          kind: "DEPOSIT",
          amount,
          payableAmount: amount,
          paymentStatus: "PENDING",
          dueDay: entry.dueDay ?? 7,
          month,
          year,
          date: new Date(year, month - 1, Math.min(entry.dueDay ?? 7, 28)),
          notes: entry.notes,
        },
      });
    }
    return;
  }

  // No previous entries — seed pending deposits from Saving master goals
  const alreadyHasAny = await prisma.savingEntry.count({
    where: { userId, month, year },
  });
  if (alreadyHasAny > 0) return;

  const masters = await prisma.saving.findMany({ where: { userId } });
  for (const master of masters) {
    const amount = decimalToNumber(master.amount);
    if (amount <= 0) continue;
    await prisma.savingEntry.create({
      data: {
        userId,
        name: master.name,
        type: master.type,
        kind: "DEPOSIT",
        amount,
        payableAmount: amount,
        paymentStatus: "PENDING",
        dueDay: 7,
        month,
        year,
        date: new Date(year, month - 1, 7),
      },
    });
  }
}
