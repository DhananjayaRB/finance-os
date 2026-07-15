import prisma from "@/lib/db";
import { updateForUser, deleteForUser } from "@/lib/prisma-helpers";
import { parseLoanType } from "@/lib/constants";
import { formatPrismaError } from "@/lib/prisma-errors";
import { decimalToNumber, formatCurrency } from "@/lib/utils";
import { computePaymentStatus, isBeforeSalary, getStatusMeta, resolveDisplayStatus, PAYMENT_STATUS_META } from "@/lib/payment-status";
import { insuranceMonthlyAmount } from "@/lib/account-ledger";
import {
  getPlanPayableState,
  resolvePayableFromRecord,
  syncIncomeLedger,
  syncPayableLedgerDelta,
  syncPlanItemCreateLedger,
  syncPlanItemDeleteLedger,
  getMonthPlanPayableState,
  resolveMonthRowPayable,
} from "@/lib/plan-ledger-sync";
import {
  ensureMonthPlanPayments,
  getMonthPaymentMap,
  monthPaymentKey,
  planItemTypeToSourceType,
  planPayableTypeToSourceType,
  getMonthPaymentForItem,
  updateMonthPayment,
  createMonthPaymentForNewItem,
  deleteMonthPaymentsForSource,
  resetMonthPlanPayments,
  copyIncomeToMonth,
  ensureMonthSavingsPlan,
} from "@/lib/plan-month-payments";
import { buildPlanAlerts } from "@/lib/plan-alerts";
import type { PaymentStatus } from "@/generated/prisma/client";
import type {
  ExcelPlanItem,
  ExcelMonthlyPlan,
  PlanItemType,
} from "@/lib/monthly-plan-types";

export type {
  ExcelPlanItem,
  ExcelMonthlyPlan,
  PlanItemType,
} from "@/lib/monthly-plan-types";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(month: number, year: number) {
  return `${MONTHS[month - 1]} ${year}`;
}

function salaryCycleLabel(month: number, year: number, salaryDay: number) {
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  return `${salaryDay} ${MONTHS[month - 1]} → ${salaryDay - 1} ${MONTHS[endMonth - 1]} ${endYear}`;
}

function mapLoan(
  loan: {
    id: string;
    name: string;
    emiAmount: unknown;
    outstanding: unknown;
    pendingEmi: number;
    emiDate: number;
    interestRate: unknown;
    payableAmount: unknown;
    paymentStatus: PaymentStatus;
    status: string;
    loanType: string;
  },
  salaryDay: number,
  currentDay: number
): ExcelPlanItem {
  const amount = decimalToNumber(loan.emiAmount as string | number);
  const payable = decimalToNumber(loan.payableAmount as string | number);
  const isClosed = loan.status === "CLOSED";
  const paymentStatus = resolveDisplayStatus({
    stored: loan.paymentStatus,
    payable,
    isClosed,
  });
  const meta = getStatusMeta(paymentStatus);

  return {
    id: loan.id,
    name: loan.name,
    amount,
    outstanding: decimalToNumber(loan.outstanding as string | number),
    pendingEmi: loan.pendingEmi,
    emiDate: loan.emiDate,
    interestRate: decimalToNumber(loan.interestRate as string | number),
    payable,
    paymentStatus,
    statusLabel: meta.label,
    statusColor: meta.color,
    beforeSalary: isBeforeSalary(loan.emiDate, salaryDay),
    loanType: loan.loanType,
  };
}

function mapFixedExpense(
  fe: {
    id: string;
    name: string;
    amount: unknown;
    payableAmount: unknown;
    paymentStatus: PaymentStatus;
    dueDay: number | null;
    category: string | null;
  },
  salaryDay: number,
  currentDay: number
): ExcelPlanItem {
  const amount = decimalToNumber(fe.amount as string | number);
  let payable = decimalToNumber(fe.payableAmount as string | number);
  if (payable <= 0 && fe.paymentStatus !== "PAID" && amount > 0) {
    payable = amount;
  }
  const paymentStatus = resolveDisplayStatus({
    stored: fe.paymentStatus,
    payable,
  });
  const meta = getStatusMeta(paymentStatus);

  return {
    id: fe.id,
    name: fe.name,
    amount,
    payable,
    paymentStatus,
    statusLabel: meta.label,
    statusColor: meta.color,
    beforeSalary: isBeforeSalary(fe.dueDay ?? salaryDay, salaryDay),
    category: fe.category ?? undefined,
    emiDate: fe.dueDay ?? undefined,
  };
}

function amountForSalarySplit(item: ExcelPlanItem): number {
  return item.amount;
}

function mapSavingEntry(
  e: {
    id: string;
    name: string;
    type: string;
    kind: string;
    amount: unknown;
    payableAmount: unknown;
    paymentStatus: PaymentStatus;
    dueDay: number | null;
    date: Date;
  },
  salaryDay: number
): ExcelPlanItem {
  const amount = decimalToNumber(e.amount as string | number);
  const kind = e.kind as "DEPOSIT" | "WITHDRAWAL" | "MISSED";
  const dueDay = e.dueDay ?? e.date.getDate();

  if (kind === "WITHDRAWAL") {
    return {
      id: e.id,
      name: e.name,
      amount: -amount,
      payable: 0,
      paymentStatus: "PAID",
      statusLabel: "Withdrawn",
      statusColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
      beforeSalary: isBeforeSalary(dueDay, salaryDay),
      savingType: e.type,
      savingSource: "entry",
      savingKind: kind,
      emiDate: dueDay,
    };
  }

  if (kind === "MISSED") {
    return {
      id: e.id,
      name: e.name,
      amount,
      payable: 0,
      paymentStatus: "OVERDUE",
      statusLabel: "Missed",
      statusColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      beforeSalary: isBeforeSalary(dueDay, salaryDay),
      savingType: e.type,
      savingSource: "entry",
      savingKind: kind,
      emiDate: dueDay,
    };
  }

  // DEPOSIT — respect stored status (Logged when PAID, Pending when not yet done)
  let payable = decimalToNumber(e.payableAmount as string | number);
  const storedStatus = e.paymentStatus;
  if (payable <= 0 && storedStatus !== "PAID" && amount > 0) {
    payable = amount;
  }
  if (storedStatus === "PAID") payable = 0;

  const paymentStatus = resolveDisplayStatus({ stored: storedStatus, payable });
  const meta = getStatusMeta(paymentStatus);
  const isLogged = storedStatus === "PAID";

  return {
    id: e.id,
    name: e.name,
    amount,
    payable,
    paymentStatus,
    statusLabel: isLogged ? "Logged" : meta.label,
    statusColor: isLogged
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : meta.color,
    beforeSalary: isBeforeSalary(dueDay, salaryDay),
    savingType: e.type,
    savingSource: "entry",
    savingKind: kind,
    emiDate: dueDay,
  };
}

function mapSaving(
  s: {
    id: string;
    name: string;
    type: string;
    amount: unknown;
    payableAmount: unknown;
    paymentStatus: PaymentStatus;
  },
  salaryDay: number,
  _currentDay: number
): ExcelPlanItem {
  const amount = decimalToNumber(s.amount as string | number);
  let payable = decimalToNumber(s.payableAmount as string | number);
  const storedStatus = s.paymentStatus;
  // Legacy rows: amount set but payableAmount left at 0
  if (payable <= 0 && storedStatus !== "PAID" && amount > 0) {
    payable = amount;
  }
  const paymentStatus = resolveDisplayStatus({
    stored: storedStatus,
    payable,
  });
  const meta = getStatusMeta(paymentStatus);

  return {
    id: s.id,
    name: s.name,
    amount,
    payable,
    paymentStatus,
    statusLabel: meta.label,
    statusColor: meta.color,
    beforeSalary: true,
    savingType: s.type,
  };
}

function mapInsurance(
  ins: {
    id: string;
    name: string;
    premium: unknown;
    payableAmount: unknown;
    paymentStatus: PaymentStatus;
    renewalDay: number | null;
    insuranceType: string;
    cycle: string;
  },
  salaryDay: number,
  currentDay: number
): ExcelPlanItem {
  const amount = insuranceMonthlyAmount(
    decimalToNumber(ins.premium as string | number),
    ins.cycle
  );
  const payable = decimalToNumber(ins.payableAmount as string | number);
  const paymentStatus = resolveDisplayStatus({
    stored: ins.paymentStatus,
    payable,
  });
  const meta = getStatusMeta(paymentStatus);

  return {
    id: ins.id,
    name: ins.name,
    amount,
    payable,
    paymentStatus,
    statusLabel: meta.label,
    statusColor: meta.color,
    beforeSalary: ins.renewalDay ? isBeforeSalary(ins.renewalDay, salaryDay) : false,
    emiDate: ins.renewalDay ?? undefined,
    insuranceType: ins.insuranceType,
  };
}

function overlayMonthPayment(
  item: ExcelPlanItem,
  payment?: {
    amount: unknown;
    payableAmount: unknown;
    paymentStatus: PaymentStatus;
  }
): ExcelPlanItem {
  if (!payment) return item;
  const amount = decimalToNumber(payment.amount as string | number);
  let payable = decimalToNumber(payment.payableAmount as string | number);
  if (payable <= 0 && payment.paymentStatus !== "PAID" && amount > 0) {
    payable = amount;
  }
  if (payment.paymentStatus === "PAID") payable = 0;
  const paymentStatus = resolveDisplayStatus({
    stored: payment.paymentStatus,
    payable,
    isClosed: payment.paymentStatus === "CLOSED",
  });
  const meta = getStatusMeta(paymentStatus);
  return {
    ...item,
    amount,
    payable,
    paymentStatus,
    statusLabel: meta.label,
    statusColor: meta.color,
  };
}

export async function getExcelMonthlyPlan(
  userId: string,
  month: number,
  year: number
): Promise<ExcelMonthlyPlan> {
  const now = new Date();
  const currentDay = now.getMonth() + 1 === month && now.getFullYear() === year
    ? now.getDate()
    : 15;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const salaryDay = user?.salaryDay ?? 7;

  await ensureMonthPlanPayments(userId, month, year);
  await ensureMonthSavingsPlan(userId, month, year);

  const [loans, homeExpenses, monthlyFixed, savings, savingEntries, incomes, subscriptions, insurances, expenses, budget, accounts, cashBoxes, monthPayments] =
    await Promise.all([
      prisma.loan.findMany({
        where: { userId, status: { not: "CLOSED" } },
        orderBy: { emiDate: "asc" },
      }),
      prisma.fixedExpense.findMany({
        where: { userId, OR: [{ category: "HOME" }, { category: null }] },
        orderBy: { name: "asc" },
      }),
      prisma.fixedExpense.findMany({
        where: { userId, category: "MONTHLY_FIXED" },
        orderBy: { name: "asc" },
      }),
      prisma.saving.findMany({ where: { userId } }),
      prisma.savingEntry.findMany({
        where: { userId, month, year },
        orderBy: { date: "desc" },
      }),
      prisma.income.findMany({ where: { userId, month, year }, orderBy: { source: "asc" } }),
      prisma.subscription.findMany({ where: { userId, isActive: true } }),
      prisma.insurance.findMany({ where: { userId, isActive: true } }),
      prisma.expense.findMany({
        where: { userId, month, year },
        include: { category: true },
        orderBy: { date: "desc" },
      }),
      prisma.budget.findUnique({ where: { userId_year_month: { userId, year, month } } }),
      prisma.account.findMany({ where: { userId } }),
      prisma.cashBox.findMany({ where: { userId } }),
      getMonthPaymentMap(userId, month, year),
    ]);

  const bankBalance = accounts.reduce((s, a) => s + decimalToNumber(a.balance), 0);
  const cashInHand = cashBoxes.reduce((s, c) => s + decimalToNumber(c.balance), 0);

  const loanItems = loans.map((l) =>
    overlayMonthPayment(
      mapLoan(l, salaryDay, currentDay),
      monthPayments.get(monthPaymentKey("LOAN", l.id))
    )
  );
  const homeItems = homeExpenses
    .filter((f) => f.category === "HOME" || !f.category)
    .map((f) =>
      overlayMonthPayment(
        mapFixedExpense(f, salaryDay, currentDay),
        monthPayments.get(monthPaymentKey("HOME", f.id))
      )
    );
  const fixedItems = monthlyFixed.map((f) =>
    overlayMonthPayment(
      mapFixedExpense(f, salaryDay, currentDay),
      monthPayments.get(monthPaymentKey("MONTHLY_FIXED", f.id))
    )
  );
  const savingItems = savings.map((s) =>
    overlayMonthPayment(
      mapSaving(s, salaryDay, currentDay),
      monthPayments.get(monthPaymentKey("SAVING", s.id))
    )
  );
  const loggedSavingsRows: ExcelPlanItem[] = savingEntries.map((e) =>
    mapSavingEntry(e, salaryDay)
  );
  // Prefer month entries; only show master goals that aren't already listed as entries
  const entryNames = new Set(
    loggedSavingsRows.map((e) => e.name.trim().toLowerCase())
  );
  const planSavingsRows = savingItems
    .filter((s) => !entryNames.has(s.name.trim().toLowerCase()))
    .map((s) => ({ ...s, savingSource: "plan" as const }));
  const allSavingsRows = [...planSavingsRows, ...loggedSavingsRows];

  const incomeSources: ExcelPlanItem[] = incomes.map((inc) => {
    const amount = decimalToNumber(inc.amount);
    const received = inc.isReceived;
    return {
      id: inc.id,
      name: inc.source,
      amount,
      payable: 0,
      paymentStatus: received ? "PAID" : "PENDING",
      statusLabel: received ? "Received" : "Not Received",
      statusColor: received
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      beforeSalary: false,
      incomeType: inc.incomeType,
      isReceived: received,
    };
  });

  const subItems: ExcelPlanItem[] = subscriptions.map((sub) => {
    const amount = decimalToNumber(sub.amount);
    const base: ExcelPlanItem = {
      id: sub.id,
      name: sub.name,
      amount,
      payable: amount,
      paymentStatus: "PENDING",
      statusLabel: PAYMENT_STATUS_META.PENDING.label,
      statusColor: PAYMENT_STATUS_META.PENDING.color,
      beforeSalary: isBeforeSalary(sub.renewalDay ?? salaryDay, salaryDay),
      emiDate: sub.renewalDay ?? undefined,
    };
    return overlayMonthPayment(
      base,
      monthPayments.get(monthPaymentKey("SUBSCRIPTION", sub.id))
    );
  });

  const insuranceItems = insurances.map((ins) =>
    overlayMonthPayment(
      mapInsurance(ins, salaryDay, currentDay),
      monthPayments.get(monthPaymentKey("INSURANCE", ins.id))
    )
  );

  const savingsDeposited = savingEntries
    .filter((e) => e.kind === "DEPOSIT" && e.paymentStatus === "PAID")
    .reduce((s, e) => s + decimalToNumber(e.amount), 0);
  const savingsWithdrawn = savingEntries
    .filter((e) => e.kind === "WITHDRAWAL")
    .reduce((s, e) => s + decimalToNumber(e.amount), 0);
  const savingsMissed = savingEntries
    .filter((e) => e.kind === "MISSED")
    .reduce((s, e) => s + decimalToNumber(e.amount), 0);
  const actualSavingsTotal = savingsDeposited - savingsWithdrawn;
  const actualByTypeMap: Record<string, number> = {};
  for (const e of savingEntries) {
    const amt = decimalToNumber(e.amount);
    const signed =
      e.kind === "WITHDRAWAL" ? -amt : e.kind === "MISSED" ? 0 : amt;
    if (signed === 0) continue;
    actualByTypeMap[e.type] = (actualByTypeMap[e.type] || 0) + signed;
  }
  const actualSavingsByType = Object.entries(actualByTypeMap)
    .map(([type, total]) => ({ type, total }))
    .sort((a, b) => b.total - a.total);

  const otherSpendByClass = { need: 0, want: 0, luxury: 0, savings: 0 };
  for (const exp of expenses) {
    const amt = decimalToNumber(exp.amount);
    const cls = exp.classification.toLowerCase() as keyof typeof otherSpendByClass;
    if (cls in otherSpendByClass) otherSpendByClass[cls] += amt;
  }
  const otherSpendTotal = Object.values(otherSpendByClass).reduce((s, v) => s + v, 0);
  const otherSpendItems: ExcelPlanItem[] = expenses.slice(0, 20).map((exp) => ({
    id: exp.id,
    name: exp.merchant || exp.category?.name || "Expense",
    amount: decimalToNumber(exp.amount),
    payable: decimalToNumber(exp.amount),
    paymentStatus: "PAID" as PaymentStatus,
    statusLabel: exp.classification,
    statusColor: "bg-zinc-100 text-zinc-700",
    beforeSalary: exp.date.getDate() < salaryDay,
    category: exp.classification,
  }));

  const loanEmi = loanItems.reduce((s, l) => s + l.amount, 0);
  const loanPayable = loanItems.reduce((s, l) => s + l.payable, 0);
  const loanOutstanding = loanItems.reduce((s, l) => s + (l.outstanding ?? 0), 0);
  const homeTotal = homeItems.reduce((s, h) => s + h.amount, 0);
  const homePayable = homeItems.reduce((s, h) => s + h.payable, 0);
  const savingsTotal = planSavingsRows.reduce((s, sv) => s + sv.amount, 0);
  const savingsPayableFromPlan = planSavingsRows.reduce((s, sv) => s + sv.payable, 0);
  const savingsPayableFromEntries = loggedSavingsRows.reduce((s, sv) => s + sv.payable, 0);
  const savingsRemainingToSave = Math.max(0, savingsTotal - savingsDeposited);
  const savingsPayable = Math.max(
    savingsPayableFromPlan + savingsPayableFromEntries,
    savingsRemainingToSave
  );
  const savingsCommitted = Math.max(
    savingsTotal,
    allSavingsRows
      .filter((s) => s.savingKind !== "WITHDRAWAL" && s.savingKind !== "MISSED")
      .reduce((sum, s) => sum + Math.abs(s.amount), 0)
  );
  const fixedTotal = fixedItems.reduce((s, f) => s + f.amount, 0);
  const fixedPayable = fixedItems.reduce((s, f) => s + f.payable, 0);
  const subscriptionTotal = subItems.reduce((s, sub) => s + sub.amount, 0);
  const subscriptionPayable = subItems.reduce((s, sub) => s + sub.payable, 0);
  const insuranceTotal = insuranceItems.reduce((s, ins) => s + ins.amount, 0);
  const insurancePayable = insuranceItems.reduce((s, ins) => s + ins.payable, 0);

  const planIncome = decimalToNumber(budget?.totalIncome ?? 135000);
  const breakdownTotal = incomeSources.reduce((s, i) => s + i.amount, 0);
  const subTotalOther = incomeSources
    .filter((i) => i.incomeType !== "SALARY")
    .reduce((s, i) => s + i.amount, 0);

  const totalRequired =
    loanEmi + homeTotal + savingsCommitted + fixedTotal + subscriptionTotal + insuranceTotal;
  const allPayable =
    loanPayable + homePayable + savingsPayable + fixedPayable + subscriptionPayable + insurancePayable;
  // Plan balance = income vs plan commitments only (expenses tracked separately)
  const balance = planIncome - totalRequired;

  const incomeReceived = incomeSources
    .filter((i) => i.isReceived)
    .reduce((s, i) => s + i.amount, 0);
  const salaryReceived = incomeSources
    .filter((i) => i.incomeType === "SALARY" && i.isReceived)
    .reduce((s, i) => s + i.amount, 0);

  const salaryBreakdown = {
    incomeReceived,
    salaryReceived,
    planIncome,
    emi: loanEmi,
    homeExpense: homeTotal,
    fixedExpense: fixedTotal,
    subscriptions: subscriptionTotal,
    insurance: insuranceTotal,
    savingsLogged: actualSavingsTotal,
    otherExpenses: 0, // tracked on Expenses page — not part of monthly plan
    totalSpent:
      loanEmi +
      homeTotal +
      fixedTotal +
      subscriptionTotal +
      insuranceTotal +
      actualSavingsTotal,
    remaining:
      incomeReceived -
      (loanEmi +
        homeTotal +
        fixedTotal +
        subscriptionTotal +
        insuranceTotal +
        actualSavingsTotal),
  };

  const beforeSalary = {
    loan: loanItems.filter((l) => l.beforeSalary).reduce((s, l) => s + amountForSalarySplit(l), 0),
    home: homeItems.filter((h) => h.beforeSalary).reduce((s, h) => s + amountForSalarySplit(h), 0),
    savings: allSavingsRows.filter((s) => s.beforeSalary).reduce((s, sv) => s + amountForSalarySplit(sv), 0),
    fixed: fixedItems.filter((f) => f.beforeSalary).reduce((s, f) => s + amountForSalarySplit(f), 0),
    subscriptions: subItems.filter((s) => s.beforeSalary).reduce((s, sub) => s + amountForSalarySplit(sub), 0),
    insurance: insuranceItems.filter((i) => i.beforeSalary).reduce((s, ins) => s + amountForSalarySplit(ins), 0),
    total: 0,
  };
  beforeSalary.total =
    beforeSalary.loan + beforeSalary.home + beforeSalary.savings +
    beforeSalary.fixed + beforeSalary.subscriptions + beforeSalary.insurance;

  const afterSalary = {
    loan: loanItems.filter((l) => !l.beforeSalary).reduce((s, l) => s + amountForSalarySplit(l), 0),
    home: homeItems.filter((h) => !h.beforeSalary).reduce((s, h) => s + amountForSalarySplit(h), 0),
    savings: allSavingsRows.filter((s) => !s.beforeSalary).reduce((s, sv) => s + amountForSalarySplit(sv), 0),
    fixed: fixedItems.filter((f) => !f.beforeSalary).reduce((s, f) => s + amountForSalarySplit(f), 0),
    subscriptions: subItems.filter((s) => !s.beforeSalary).reduce((s, sub) => s + amountForSalarySplit(sub), 0),
    insurance: insuranceItems.filter((i) => !i.beforeSalary).reduce((s, ins) => s + amountForSalarySplit(ins), 0),
    total: 0,
  };
  afterSalary.total =
    afterSalary.loan + afterSalary.home + afterSalary.savings +
    afterSalary.fixed + afterSalary.subscriptions + afterSalary.insurance;

  const insights = generateInsights({
    balance,
    allPayable,
    loanPayable,
    homePayable,
    loanItems,
    homeItems,
    salaryDay,
    currentDay,
  });

  const response: ExcelMonthlyPlan = {
    month,
    year,
    monthLabel: monthLabel(month, year),
    salaryCycle: salaryCycleLabel(month, year, salaryDay),
    salaryDay,
    currentDay,
    income: {
      planTotal: planIncome,
      sources: incomeSources,
      breakdownTotal,
      subTotalOther,
    },
    loans: loanItems,
    homeExpenses: homeItems,
    savings: allSavingsRows,
    monthlyFixedExpenses: fixedItems,
    subscriptions: subItems,
    insurances: insuranceItems,
    actualSavings: {
      total: actualSavingsTotal,
      deposited: savingsDeposited,
      withdrawn: savingsWithdrawn,
      missed: savingsMissed,
      entries: savingEntries.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        kind: e.kind,
        amount: decimalToNumber(e.amount),
        date: e.date.toISOString(),
      })),
      byType: actualSavingsByType,
    },
    otherSpend: {
      total: otherSpendTotal,
      need: otherSpendByClass.need,
      want: otherSpendByClass.want,
      luxury: otherSpendByClass.luxury,
      savings: otherSpendByClass.savings,
      items: otherSpendItems,
    },
    totals: {
      loanEmi,
      loanOutstanding,
      loanPayable,
      homeTotal,
      homePayable,
      savingsTotal,
      savingsPayable,
      fixedTotal,
      fixedPayable,
      subscriptionTotal,
      subscriptionPayable,
      insuranceTotal,
      insurancePayable,
      otherSpendTotal,
      allPayable,
      totalRequired,
      balance,
      savingsDeposited,
      savingsWithdrawn,
      savingsMissed,
      savingsNetSaved: actualSavingsTotal,
      savingsStillToSave: savingsRemainingToSave,
      beforeSalary,
      afterSalary,
    },
    insights,
    history: [],
    salaryBreakdown,
    consolidated: {
      bankBalance,
      cashInHand,
      totalLiquidity: bankBalance + cashInHand,
    },
    planAlerts: [],
  };

  response.planAlerts = buildPlanAlerts(response);
  return response;
}

function generateInsights(params: {
  balance: number;
  allPayable: number;
  loanPayable: number;
  homePayable: number;
  loanItems: ExcelPlanItem[];
  homeItems: ExcelPlanItem[];
  salaryDay: number;
  currentDay: number;
}) {
  const insights: ExcelMonthlyPlan["insights"] = [];

  if (params.balance >= 0) {
    insights.push({
      type: "success",
      title: "Plan Balanced",
      message: `Remaining ${formatCurrency(params.balance)} after all obligations — matches your Excel target.`,
    });
  } else {
    insights.push({
      type: "critical",
      title: "Deficit Alert",
      message: `Shortfall of ${formatCurrency(Math.abs(params.balance))}. Reduce plan commitments or increase income.`,
    });
  }

  const overdueLoans = params.loanItems.filter((l) => l.paymentStatus === "OVERDUE");
  if (overdueLoans.length > 0) {
    insights.push({
      type: "critical",
      title: `${overdueLoans.length} Overdue EMI(s)`,
      message: overdueLoans.map((l) => l.name).join(", ") + " — pay immediately to avoid penalties.",
    });
  }

  const dueToday = [...params.loanItems, ...params.homeItems].filter(
    (i) => i.paymentStatus === "DUE"
  );
  if (dueToday.length > 0) {
    insights.push({
      type: "warning",
      title: "Due This Week",
      message: `${dueToday.length} payment(s) due — total ${formatCurrency(dueToday.reduce((s, i) => s + i.payable, 0))}`,
    });
  }

  if (params.currentDay < params.salaryDay) {
    insights.push({
      type: "info",
      title: "Pre-Salary Period",
      message: `Before ${params.salaryDay}th: ${formatCurrency(params.allPayable)} payable. Reserve cash for EMIs on 2nd, 5th.`,
    });
  }

  insights.push({
    type: "info",
    title: "Before vs After Salary",
    message: `Before salary payable: ${formatCurrency(params.loanItems.filter((l) => l.beforeSalary).reduce((s, l) => s + l.payable, 0) + params.homeItems.filter((h) => h.beforeSalary).reduce((s, h) => s + h.payable, 0))}. After salary: rest of month.`,
  });

  return insights.slice(0, 5);
}

export async function markItemPaid(
  userId: string,
  month: number,
  year: number,
  type: "loan" | "home" | "saving" | "insurance" | "income" | "subscription",
  id: string
) {
  if (type === "income") {
    const before = await prisma.income.findFirst({ where: { id, userId, month, year } });
    if (!before) return null;
    const result = await updateForUser("income", userId, id, { isReceived: true });
    if (!result) return null;
    const accountId = await syncIncomeLedger({
      userId,
      incomeId: id,
      isReceived: true,
      amount: Number((result as { amount: unknown }).amount),
      source: String((result as { source: string }).source),
      accountId: (result as { accountId?: string | null }).accountId ?? before.accountId,
    });
    if (accountId && !(result as { accountId?: string | null }).accountId) {
      return updateForUser("income", userId, id, { accountId });
    }
    return result;
  }

  if (type === "saving") {
    const entry = await prisma.savingEntry.findFirst({ where: { id, userId, month, year } });
    if (entry) {
      const before = await getPlanPayableState(userId, "saving", id);
      const result = await updateForUser("savingEntry", userId, id, {
        payableAmount: 0,
        paymentStatus: "PAID",
      });
      if (!result || !before || before.skipLedger) return result;
      await syncPayableLedgerDelta({
        userId,
        refType: before.refType,
        refId: id,
        previousPayable: before.payable,
        newPayable: 0,
        label: before.label,
      });
      return result;
    }
  }

  const sourceType = planPayableTypeToSourceType(type);
  const monthRow = await getMonthPaymentForItem(userId, month, year, sourceType, id);
  if (!monthRow) return null;

  const before = await getMonthPlanPayableState(monthRow);
  const result = await updateMonthPayment(userId, month, year, sourceType, id, {
    paymentStatus: "PAID",
    payableAmount: 0,
  });
  if (!result) return null;

  await syncPayableLedgerDelta({
    userId,
    refType: "plan_month",
    refId: monthRow.id,
    previousPayable: before.payable,
    newPayable: 0,
    label: before.label,
  });

  return result;
}

export async function updatePlanItem(
  userId: string,
  month: number,
  year: number,
  type: PlanItemType,
  id: string,
  data: Record<string, unknown>
) {
  try {
    switch (type) {
      case "loan": {
        const paymentStatus = data.paymentStatus as PaymentStatus | undefined;
        const loanType = data.loanType !== undefined ? parseLoanType(data.loanType) : undefined;
        if (data.loanType !== undefined && !loanType) {
          throw new Error(`Invalid loan type: ${data.loanType}`);
        }
        const monthRow = await getMonthPaymentForItem(userId, month, year, "LOAN", id);
        const before = monthRow ? await getMonthPlanPayableState(monthRow) : null;

        const result = await updateForUser("loan", userId, id, {
          ...(data.name !== undefined && { name: String(data.name) }),
          ...(data.emiAmount !== undefined && { emiAmount: Number(data.emiAmount) }),
          ...(data.outstanding !== undefined && { outstanding: Number(data.outstanding) }),
          ...(data.pendingEmi !== undefined && { pendingEmi: Number(data.pendingEmi) }),
          ...(data.emiDate !== undefined && { emiDate: Number(data.emiDate) }),
          ...(data.interestRate !== undefined && { interestRate: Number(data.interestRate) }),
          ...(loanType !== undefined && { loanType }),
          ...(paymentStatus === "CLOSED" && { status: "CLOSED" }),
        });
        if (!result) throw new Error("Loan not found");

        if (monthRow) {
          const newAmount =
            data.emiAmount !== undefined ? Number(data.emiAmount) : decimalToNumber(monthRow.amount);
          const monthResult = await updateMonthPayment(userId, month, year, "LOAN", id, {
            amount: newAmount,
            ...(data.payableAmount !== undefined && { payableAmount: Number(data.payableAmount) }),
            ...(paymentStatus !== undefined && { paymentStatus }),
          });
          if (monthResult && before) {
            const newPayable = resolveMonthRowPayable(monthResult);
            if (before.payable !== newPayable) {
              await syncPayableLedgerDelta({
                userId,
                refType: "plan_month",
                refId: monthResult.id,
                previousPayable: before.payable,
                newPayable,
                label: before.label,
              });
            }
          }
        }
        return result;
      }
    case "home":
    case "monthly_fixed": {
      const paymentStatus = data.paymentStatus as PaymentStatus | undefined;
      const sourceType = type === "home" ? "HOME" : "MONTHLY_FIXED";
      const monthRow = await getMonthPaymentForItem(userId, month, year, sourceType, id);
      const before = monthRow ? await getMonthPlanPayableState(monthRow) : null;

      const result = await updateForUser("fixedExpense", userId, id, {
        ...(data.name !== undefined && { name: String(data.name) }),
        ...(data.amount !== undefined && { amount: Number(data.amount) }),
        ...(data.dueDay !== undefined && { dueDay: Number(data.dueDay) }),
      });
      if (!result) throw new Error("Item not found");

      if (monthRow) {
        const newAmount =
          data.amount !== undefined ? Number(data.amount) : decimalToNumber(monthRow.amount);
        const monthResult = await updateMonthPayment(userId, month, year, sourceType, id, {
          amount: newAmount,
          ...(data.payableAmount !== undefined && { payableAmount: Number(data.payableAmount) }),
          ...(paymentStatus !== undefined && { paymentStatus }),
        });
        if (monthResult && before) {
          const newPayable = resolveMonthRowPayable(monthResult);
          if (before.payable !== newPayable) {
            await syncPayableLedgerDelta({
              userId,
              refType: "plan_month",
              refId: monthResult.id,
              previousPayable: before.payable,
              newPayable,
              label: before.label,
            });
          }
        }
      }
      return result;
    }
    case "saving": {
      const paymentStatus = data.paymentStatus as PaymentStatus | undefined;
      const amount = Number(data.amount) || 0;
      let payableAmount =
        data.payableAmount !== undefined ? Number(data.payableAmount) : amount;
      if (paymentStatus === "PAID") payableAmount = 0;
      else if (payableAmount <= 0 && amount > 0) payableAmount = amount;

      const entry = await prisma.savingEntry.findFirst({ where: { id, userId, month, year } });
      if (entry) {
        const before = await getPlanPayableState(userId, "saving", id);
        const result = await updateForUser("savingEntry", userId, id, {
          ...(data.name !== undefined && { name: String(data.name) }),
          ...(data.amount !== undefined && { amount }),
          payableAmount,
          ...(paymentStatus !== undefined && { paymentStatus }),
          ...(paymentStatus === "PAID" && { payableAmount: 0 }),
        });
        if (!result) throw new Error("Item not found");
        if (before && !before.skipLedger) {
          await syncPayableLedgerDelta({
            userId,
            refType: before.refType,
            refId: id,
            previousPayable: before.payable,
            newPayable: resolvePayableFromRecord(before.refType, result as Record<string, unknown>),
            label: before.label,
          });
        }
        return result;
      }

      const monthRow = await getMonthPaymentForItem(userId, month, year, "SAVING", id);
      const before = monthRow ? await getMonthPlanPayableState(monthRow) : null;
      const result = await updateForUser("saving", userId, id, {
        ...(data.name !== undefined && { name: String(data.name) }),
        ...(data.amount !== undefined && { amount }),
        ...(data.savingType !== undefined && { type: data.savingType }),
      });
      if (!result) throw new Error("Item not found");

      if (monthRow) {
        const monthResult = await updateMonthPayment(userId, month, year, "SAVING", id, {
          amount,
          payableAmount,
          ...(paymentStatus !== undefined && { paymentStatus }),
        });
        if (monthResult && before) {
          const newPayable = resolveMonthRowPayable(monthResult);
          if (before.payable !== newPayable) {
            await syncPayableLedgerDelta({
              userId,
              refType: "plan_month",
              refId: monthResult.id,
              previousPayable: before.payable,
              newPayable,
              label: before.label,
            });
          }
        }
      }
      return result;
    }
    case "income": {
      const before = await prisma.income.findFirst({ where: { id, userId } });
      const result = await updateForUser("income", userId, id, {
        ...(data.name !== undefined && { source: String(data.name) }),
        ...(data.amount !== undefined && { amount: Number(data.amount) }),
        ...(data.incomeType !== undefined && {
          incomeType: data.incomeType as "SALARY" | "HDFC" | "CANARA" | "GOLD" | "PF" | "OTHER",
        }),
        ...(data.isReceived !== undefined && { isReceived: Boolean(data.isReceived) }),
      });
      if (!result) throw new Error("Item not found");
      const row = result as {
        amount: unknown;
        source: string;
        isReceived: boolean;
        accountId?: string | null;
      };
      const accountId = await syncIncomeLedger({
        userId,
        incomeId: id,
        isReceived: row.isReceived,
        amount: Number(row.amount),
        source: row.source,
        accountId: row.accountId ?? before?.accountId,
      });
      if (accountId && !row.accountId) {
        return updateForUser("income", userId, id, { accountId });
      }
      return result;
    }
    case "subscription": {
      const paymentStatus = data.paymentStatus as PaymentStatus | undefined;
      const amount = Number(data.amount) || 0;
      let payableAmount =
        data.payableAmount !== undefined ? Number(data.payableAmount) : amount;
      if (paymentStatus === "PAID") payableAmount = 0;
      else if (payableAmount <= 0 && amount > 0) payableAmount = amount;

      const monthRow = await getMonthPaymentForItem(userId, month, year, "SUBSCRIPTION", id);
      const before = monthRow ? await getMonthPlanPayableState(monthRow) : null;

      const result = await updateForUser("subscription", userId, id, {
        ...(data.name !== undefined && { name: String(data.name) }),
        ...(data.amount !== undefined && { amount }),
        ...(data.renewalDay !== undefined && { renewalDay: Number(data.renewalDay) }),
      });
      if (!result) throw new Error("Item not found");

      if (monthRow) {
        const monthResult = await updateMonthPayment(userId, month, year, "SUBSCRIPTION", id, {
          amount,
          payableAmount,
          ...(paymentStatus !== undefined && { paymentStatus }),
        });
        if (monthResult && before) {
          const newPayable = resolveMonthRowPayable(monthResult);
          if (before.payable !== newPayable) {
            await syncPayableLedgerDelta({
              userId,
              refType: "plan_month",
              refId: monthResult.id,
              previousPayable: before.payable,
              newPayable,
              label: before.label,
            });
          }
        }
      }
      return result;
    }
    case "insurance": {
      const paymentStatus = data.paymentStatus as PaymentStatus | undefined;
      const monthRow = await getMonthPaymentForItem(userId, month, year, "INSURANCE", id);
      const before = monthRow ? await getMonthPlanPayableState(monthRow) : null;

      const result = await updateForUser("insurance", userId, id, {
        ...(data.name !== undefined && { name: String(data.name) }),
        ...(data.amount !== undefined && { premium: Number(data.amount) }),
        ...(data.renewalDay !== undefined && { renewalDay: Number(data.renewalDay) }),
        ...(data.insuranceType !== undefined && { insuranceType: data.insuranceType }),
      });
      if (!result) throw new Error("Item not found");

      if (monthRow) {
        const newAmount =
          data.amount !== undefined ? Number(data.amount) : decimalToNumber(monthRow.amount);
        const monthResult = await updateMonthPayment(userId, month, year, "INSURANCE", id, {
          amount: newAmount,
          ...(data.payableAmount !== undefined && { payableAmount: Number(data.payableAmount) }),
          ...(paymentStatus !== undefined && { paymentStatus }),
        });
        if (monthResult && before) {
          const newPayable = resolveMonthRowPayable(monthResult);
          if (before.payable !== newPayable) {
            await syncPayableLedgerDelta({
              userId,
              refType: "plan_month",
              refId: monthResult.id,
              previousPayable: before.payable,
              newPayable,
              label: before.label,
            });
          }
        }
      }
      return result;
    }
    default:
      throw new Error("Unknown item type");
    }
  } catch (err) {
    throw new Error(formatPrismaError(err));
  }
}

export async function createPlanItem(
  userId: string,
  month: number,
  year: number,
  type: PlanItemType,
  data: Record<string, unknown>
) {
  try {
    const name = String(data.name || "").trim();
    if (!name) throw new Error("Name is required");

    const paymentStatus = (data.paymentStatus as PaymentStatus) || "PENDING";
    const amount = Number(data.amount) || 0;
    let payableAmount =
      data.payableAmount !== undefined ? Number(data.payableAmount) : amount;
    if (paymentStatus === "PAID") payableAmount = 0;
    else if (payableAmount <= 0 && amount > 0) payableAmount = amount;

    const itemMonth = Number(data.month) || month;
    const itemYear = Number(data.year) || year;
    const sourceType = planItemTypeToSourceType(type);

    switch (type) {
      case "saving": {
        const created = await prisma.saving.create({
          data: {
            userId,
            name,
            type: (data.savingType as "SIP" | "GOLD" | "PF" | "OTHER") || "SIP",
            amount,
            payableAmount: 0,
            paymentStatus: "PENDING",
            isPayable: true,
          },
        });
        if (sourceType) {
          const monthRow = await createMonthPaymentForNewItem(
            userId,
            itemMonth,
            itemYear,
            sourceType,
            created.id,
            amount,
            payableAmount,
            paymentStatus
          );
          await syncPlanItemCreateLedger(userId, "saving", {
            ...(created as unknown as Record<string, unknown>),
            id: monthRow.id,
            amount,
            payableAmount,
            paymentStatus,
          });
        }
        return created;
      }
      case "loan": {
        const loanType = parseLoanType(data.loanType) || "PERSONAL";
        const emiAmount = Number(data.emiAmount ?? data.amount) || 0;
        const created = await prisma.loan.create({
          data: {
            userId,
            name,
            emiAmount,
            outstanding: Number(data.outstanding) || 0,
            pendingEmi: Number(data.pendingEmi) || 12,
            emiDate: Number(data.emiDate) || 5,
            interestRate: Number(data.interestRate) || 12,
            payableAmount: 0,
            paymentStatus: "PENDING",
            loanType,
          },
        });
        if (sourceType) {
          const monthRow = await createMonthPaymentForNewItem(
            userId,
            itemMonth,
            itemYear,
            sourceType,
            created.id,
            emiAmount,
            payableAmount,
            paymentStatus
          );
          await syncPlanItemCreateLedger(userId, "loan", {
            id: monthRow.id,
            amount: emiAmount,
            payableAmount,
            paymentStatus,
            name,
          });
        }
        return created;
      }
      case "home": {
        const created = await prisma.fixedExpense.create({
          data: {
            userId,
            name,
            amount,
            payableAmount: 0,
            paymentStatus: "PENDING",
            dueDay: Number(data.dueDay) || 1,
            category: "HOME",
            isPayable: true,
          },
        });
        if (sourceType) {
          const monthRow = await createMonthPaymentForNewItem(
            userId,
            itemMonth,
            itemYear,
            sourceType,
            created.id,
            amount,
            payableAmount,
            paymentStatus
          );
          await syncPlanItemCreateLedger(userId, "home", {
            id: monthRow.id,
            amount,
            payableAmount,
            paymentStatus,
            name,
          });
        }
        return created;
      }
      case "monthly_fixed": {
        const created = await prisma.fixedExpense.create({
          data: {
            userId,
            name,
            amount,
            payableAmount: 0,
            paymentStatus: "PAID",
            category: "MONTHLY_FIXED",
            isPayable: false,
          },
        });
        if (sourceType) {
          await createMonthPaymentForNewItem(
            userId,
            itemMonth,
            itemYear,
            sourceType,
            created.id,
            amount,
            0,
            "PAID"
          );
        }
        return created;
      }
      case "income": {
        const date = new Date(itemYear, itemMonth - 1, 1);
        const created = await prisma.income.create({
          data: {
            userId,
            source: name,
            amount,
            incomeType: (data.incomeType as "SALARY" | "OTHER") || "OTHER",
            isReceived: data.isReceived !== undefined ? Boolean(data.isReceived) : false,
            month: itemMonth,
            year: itemYear,
            date,
          },
        });
        await syncPlanItemCreateLedger(userId, "income", created as unknown as Record<string, unknown>);
        return created;
      }
      case "subscription": {
        const created = await prisma.subscription.create({
          data: {
            userId,
            name,
            amount,
            payableAmount: 0,
            paymentStatus: "PENDING",
            renewalDay: Number(data.renewalDay) || 1,
            isActive: true,
          },
        });
        if (sourceType) {
          const monthRow = await createMonthPaymentForNewItem(
            userId,
            itemMonth,
            itemYear,
            sourceType,
            created.id,
            amount,
            payableAmount,
            paymentStatus
          );
          await syncPlanItemCreateLedger(userId, "subscription", {
            id: monthRow.id,
            amount,
            payableAmount,
            paymentStatus,
            name,
          });
        }
        return created;
      }
      case "insurance": {
        const created = await prisma.insurance.create({
          data: {
            userId,
            name,
            premium: amount,
            payableAmount: 0,
            paymentStatus: "PENDING",
            renewalDay: Number(data.renewalDay) || 1,
            insuranceType: (data.insuranceType as "MEDICAL" | "OTHER") || "MEDICAL",
            cycle: "MONTHLY",
            isActive: true,
          },
        });
        if (sourceType) {
          const monthRow = await createMonthPaymentForNewItem(
            userId,
            itemMonth,
            itemYear,
            sourceType,
            created.id,
            amount,
            payableAmount,
            paymentStatus
          );
          await syncPlanItemCreateLedger(userId, "insurance", {
            id: monthRow.id,
            amount,
            payableAmount,
            paymentStatus,
            name,
          });
        }
        return created;
      }
      default:
        throw new Error(`Cannot create item type: ${type}`);
    }
  } catch (err) {
    throw new Error(formatPrismaError(err));
  }
}

export async function deletePlanItem(
  userId: string,
  month: number,
  year: number,
  type: PlanItemType,
  id: string
) {
  const modelMap = {
    loan: "loan",
    home: "fixedExpense",
    monthly_fixed: "fixedExpense",
    saving: "saving",
    income: "income",
    subscription: "subscription",
    insurance: "insurance",
  } as const;

  const model = modelMap[type];
  if (!model) throw new Error(`Cannot delete item type: ${type}`);

  const sourceType = planItemTypeToSourceType(type);
  if (sourceType) {
    const monthRow = await prisma.planMonthPayment.findUnique({
      where: {
        userId_month_year_sourceType_sourceId: {
          userId,
          month,
          year,
          sourceType,
          sourceId: id,
        },
      },
    });
    if (monthRow) {
      await syncPlanItemDeleteLedger(userId, type, monthRow.id, "plan_month");
    }
  } else {
    await syncPlanItemDeleteLedger(userId, type, id);
  }

  const deleted = await deleteForUser(model, userId, id);
  if (!deleted && type === "saving") {
    const entryDeleted = await deleteForUser("savingEntry", userId, id);
    if (!entryDeleted) throw new Error("Item not found");
    return { success: true };
  }
  if (!deleted) throw new Error("Item not found");

  await deleteMonthPaymentsForSource(userId, id);
  return { success: true };
}

export async function updatePlanSummary(
  userId: string,
  month: number,
  year: number,
  planIncome: number
) {
  return prisma.budget.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: { userId, month, year, totalIncome: planIncome },
    update: { totalIncome: planIncome },
  });
}

export async function copyPlanFromPreviousMonth(userId: string, month: number, year: number) {
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth <= 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  const prev = await prisma.budget.findUnique({
    where: { userId_year_month: { userId, year: prevYear, month: prevMonth } },
  });
  if (!prev) return null;

  const rest = {
    totalIncome: prev.totalIncome,
    needAmount: prev.needAmount,
    wantAmount: prev.wantAmount,
    luxuryAmount: prev.luxuryAmount,
    savingsAmount: prev.savingsAmount,
    investmentAmount: prev.investmentAmount,
    emiAmount: prev.emiAmount,
    fixedExpense: prev.fixedExpense,
    subscriptionAmount: prev.subscriptionAmount,
    carryForward: prev.carryForward,
  };

  const budget = await prisma.budget.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: { userId, month, year, ...rest },
    update: rest,
  });

  await copyIncomeToMonth(userId, prevMonth, prevYear, month, year);
  await resetMonthPlanPayments(userId, month, year);
  await ensureMonthSavingsPlan(userId, month, year, {
    force: true,
    fromMonth: prevMonth,
    fromYear: prevYear,
  });

  return budget;
}

export async function initializeMonthPlan(userId: string, month: number, year: number) {
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth <= 0) {
    prevMonth = 12;
    prevYear -= 1;
  }

  await resetMonthPlanPayments(userId, month, year);
  await ensureMonthSavingsPlan(userId, month, year, {
    force: true,
    fromMonth: prevMonth,
    fromYear: prevYear,
  });
  return { success: true };
}

export { MONTHS, monthLabel };

// Backward compat alias
export async function getMonthlyPlanAnalysis(userId: string, month: number, year: number) {
  return getExcelMonthlyPlan(userId, month, year);
}
