import prisma from "@/lib/db";
import { updateForUser, deleteForUser } from "@/lib/prisma-helpers";
import { parseLoanType } from "@/lib/constants";
import { formatPrismaError } from "@/lib/prisma-errors";
import { decimalToNumber, formatCurrency } from "@/lib/utils";
import { computePaymentStatus, isBeforeSalary, getStatusMeta, resolveDisplayStatus } from "@/lib/payment-status";
import { insuranceMonthlyAmount } from "@/lib/account-ledger";
import type { PaymentStatus } from "@/generated/prisma/client";

export interface ExcelPlanItem {
  id: string;
  name: string;
  amount: number;
  outstanding?: number;
  pendingEmi?: number;
  emiDate?: number;
  interestRate?: number;
  payable: number;
  paymentStatus: PaymentStatus;
  statusLabel: string;
  statusColor: string;
  beforeSalary: boolean;
  loanType?: string;
  incomeType?: string;
  insuranceType?: string;
  savingType?: string;
  savingSource?: "plan" | "entry";
  isReceived?: boolean;
  category?: string;
}

export interface ExcelMonthlyPlan {
  month: number;
  year: number;
  monthLabel: string;
  salaryCycle: string;
  salaryDay: number;
  currentDay: number;

  income: {
    planTotal: number;
    sources: ExcelPlanItem[];
    breakdownTotal: number;
    subTotalOther: number;
  };

  loans: ExcelPlanItem[];
  homeExpenses: ExcelPlanItem[];
  savings: ExcelPlanItem[];
  monthlyFixedExpenses: ExcelPlanItem[];
  subscriptions: ExcelPlanItem[];
  insurances: ExcelPlanItem[];
  actualSavings: {
    total: number;
    entries: { id: string; name: string; type: string; amount: number; date: string }[];
    byType: { type: string; total: number }[];
  };
  otherSpend: {
    total: number;
    need: number;
    want: number;
    luxury: number;
    savings: number;
    items: ExcelPlanItem[];
  };

  totals: {
    loanEmi: number;
    loanOutstanding: number;
    loanPayable: number;
    homeTotal: number;
    homePayable: number;
    savingsTotal: number;
    savingsPayable: number;
    fixedTotal: number;
    fixedPayable: number;
    subscriptionTotal: number;
    subscriptionPayable: number;
    insuranceTotal: number;
    insurancePayable: number;
    otherSpendTotal: number;
    allPayable: number;
    totalRequired: number;
    balance: number;
    beforeSalary: {
      loan: number;
      home: number;
      savings: number;
      fixed: number;
      subscriptions: number;
      insurance: number;
      total: number;
    };
    afterSalary: {
      loan: number;
      home: number;
      savings: number;
      fixed: number;
      subscriptions: number;
      insurance: number;
      total: number;
    };
  };

  insights: { type: string; title: string; message: string; action?: string }[];
  history: { label: string; planned: number; actual: number; gap: number }[];
}

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
  const payable = decimalToNumber(fe.payableAmount as string | number);
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
    beforeSalary: fe.dueDay ? isBeforeSalary(fe.dueDay, salaryDay) : false,
    category: fe.category ?? undefined,
    emiDate: fe.dueDay ?? undefined,
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
  const payable = decimalToNumber(s.payableAmount as string | number);
  const paymentStatus = resolveDisplayStatus({
    stored: s.paymentStatus,
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

  const [loans, homeExpenses, monthlyFixed, savings, savingEntries, incomes, subscriptions, insurances, expenses, budget] =
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
    ]);

  const loanItems = loans.map((l) => mapLoan(l, salaryDay, currentDay));
  const homeItems = homeExpenses
    .filter((f) => f.category === "HOME" || !f.category)
    .map((f) => mapFixedExpense(f, salaryDay, currentDay));
  const fixedItems = monthlyFixed.map((f) => mapFixedExpense(f, salaryDay, currentDay));
  const savingItems = savings.map((s) => mapSaving(s, salaryDay, currentDay));
  const planSavingsRows = savingItems.map((s) => ({ ...s, savingSource: "plan" as const }));
  const loggedSavingsRows: ExcelPlanItem[] = savingEntries.map((e) => ({
    id: e.id,
    name: e.name,
    amount: decimalToNumber(e.amount),
    payable: 0,
    paymentStatus: "PAID" as PaymentStatus,
    statusLabel: "Logged",
    statusColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    beforeSalary: true,
    savingType: e.type,
    savingSource: "entry" as const,
  }));
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
    const paymentStatus = computePaymentStatus({
      amount,
      payable: amount,
      dueDay: sub.renewalDay,
      currentDay,
    });
    const meta = getStatusMeta(paymentStatus);
    return {
      id: sub.id,
      name: sub.name,
      amount,
      payable: amount,
      paymentStatus,
      statusLabel: meta.label,
      statusColor: meta.color,
      beforeSalary: sub.renewalDay ? isBeforeSalary(sub.renewalDay, salaryDay) : false,
      emiDate: sub.renewalDay ?? undefined,
    };
  });

  const insuranceItems = insurances.map((ins) => mapInsurance(ins, salaryDay, currentDay));

  const actualSavingsTotal = savingEntries.reduce((s, e) => s + decimalToNumber(e.amount), 0);
  const actualByTypeMap: Record<string, number> = {};
  for (const e of savingEntries) {
    actualByTypeMap[e.type] = (actualByTypeMap[e.type] || 0) + decimalToNumber(e.amount);
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
  const savingsTotal = savingItems.reduce((s, sv) => s + sv.amount, 0);
  const savingsPayable = savingItems.reduce((s, sv) => s + sv.payable, 0);
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
    loanEmi + homeTotal + savingsTotal + fixedTotal + subscriptionTotal + insuranceTotal;
  const allPayable =
    loanPayable + homePayable + savingsPayable + fixedPayable + subscriptionPayable + insurancePayable;
  const balance = planIncome - totalRequired - otherSpendTotal;

  const beforeSalary = {
    loan: loanItems.filter((l) => l.beforeSalary).reduce((s, l) => s + l.payable, 0),
    home: homeItems.filter((h) => h.beforeSalary).reduce((s, h) => s + h.payable, 0),
    savings: planSavingsRows.filter((s) => s.beforeSalary).reduce((s, sv) => s + sv.payable, 0),
    fixed: fixedItems.filter((f) => f.beforeSalary).reduce((s, f) => s + f.payable, 0),
    subscriptions: subItems.filter((s) => s.beforeSalary).reduce((s, sub) => s + sub.payable, 0),
    insurance: insuranceItems.filter((i) => i.beforeSalary).reduce((s, ins) => s + ins.payable, 0),
    total: 0,
  };
  beforeSalary.total =
    beforeSalary.loan + beforeSalary.home + beforeSalary.savings +
    beforeSalary.fixed + beforeSalary.subscriptions + beforeSalary.insurance;

  const afterSalary = {
    loan: loanItems.filter((l) => !l.beforeSalary).reduce((s, l) => s + l.payable, 0),
    home: homeItems.filter((h) => !h.beforeSalary).reduce((s, h) => s + h.payable, 0),
    savings: planSavingsRows.filter((s) => !s.beforeSalary).reduce((s, sv) => s + sv.payable, 0),
    fixed: fixedItems.filter((f) => !f.beforeSalary).reduce((s, f) => s + f.payable, 0),
    subscriptions: subItems.filter((s) => !s.beforeSalary).reduce((s, sub) => s + sub.payable, 0),
    insurance: insuranceItems.filter((i) => !i.beforeSalary).reduce((s, ins) => s + ins.payable, 0),
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

  return {
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
      entries: savingEntries.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
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
      beforeSalary,
      afterSalary,
    },
    insights,
    history: [],
  };
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
      message: `Shortfall of ${formatCurrency(Math.abs(params.balance))}. Reduce Want/Luxury or defer non-essential payments.`,
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
  type: "loan" | "home" | "saving" | "insurance" | "income",
  id: string
) {
  if (type === "income") {
    return updateForUser("income", userId, id, { isReceived: true });
  }
  if (type === "loan") {
    return updateForUser("loan", userId, id, { payableAmount: 0, paymentStatus: "PAID" });
  }
  if (type === "home") {
    return updateForUser("fixedExpense", userId, id, { payableAmount: 0, paymentStatus: "PAID" });
  }
  if (type === "insurance") {
    return updateForUser("insurance", userId, id, { payableAmount: 0, paymentStatus: "PAID" });
  }
  return updateForUser("saving", userId, id, { payableAmount: 0, paymentStatus: "PAID" });
}

export type PlanItemType =
  | "loan"
  | "home"
  | "saving"
  | "income"
  | "subscription"
  | "monthly_fixed"
  | "insurance";

export async function updatePlanItem(
  userId: string,
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
        const result = await updateForUser("loan", userId, id, {
          ...(data.name !== undefined && { name: String(data.name) }),
          ...(data.emiAmount !== undefined && { emiAmount: Number(data.emiAmount) }),
          ...(data.outstanding !== undefined && { outstanding: Number(data.outstanding) }),
          ...(data.pendingEmi !== undefined && { pendingEmi: Number(data.pendingEmi) }),
          ...(data.emiDate !== undefined && { emiDate: Number(data.emiDate) }),
          ...(data.interestRate !== undefined && { interestRate: Number(data.interestRate) }),
          ...(data.payableAmount !== undefined && { payableAmount: Number(data.payableAmount) }),
          ...(loanType !== undefined && { loanType }),
          ...(paymentStatus !== undefined && { paymentStatus }),
          ...(paymentStatus === "CLOSED" && { status: "CLOSED" }),
          ...(paymentStatus === "PAID" && { payableAmount: 0 }),
        });
        if (!result) throw new Error("Loan not found");
        return result;
      }
    case "home":
    case "monthly_fixed": {
      const paymentStatus = data.paymentStatus as PaymentStatus | undefined;
      const result = await updateForUser("fixedExpense", userId, id, {
        ...(data.name !== undefined && { name: String(data.name) }),
        ...(data.amount !== undefined && { amount: Number(data.amount) }),
        ...(data.payableAmount !== undefined && { payableAmount: Number(data.payableAmount) }),
        ...(data.dueDay !== undefined && { dueDay: Number(data.dueDay) }),
        ...(paymentStatus !== undefined && { paymentStatus }),
        ...(paymentStatus === "PAID" && { payableAmount: 0 }),
      });
      if (!result) throw new Error("Item not found");
      return result;
    }
    case "saving": {
      const paymentStatus = data.paymentStatus as PaymentStatus | undefined;
      const result = await updateForUser("saving", userId, id, {
        ...(data.name !== undefined && { name: String(data.name) }),
        ...(data.amount !== undefined && { amount: Number(data.amount) }),
        ...(data.payableAmount !== undefined && { payableAmount: Number(data.payableAmount) }),
        ...(data.savingType !== undefined && { type: data.savingType }),
        ...(paymentStatus !== undefined && { paymentStatus }),
        ...(paymentStatus === "PAID" && { payableAmount: 0 }),
        ...(paymentStatus !== undefined && {
          isPayable: paymentStatus !== "PAID" && Number(data.payableAmount ?? data.amount ?? 0) > 0,
        }),
      });
      if (!result) throw new Error("Item not found");
      return result;
    }
    case "income": {
      const result = await updateForUser("income", userId, id, {
        ...(data.name !== undefined && { source: String(data.name) }),
        ...(data.amount !== undefined && { amount: Number(data.amount) }),
        ...(data.incomeType !== undefined && {
          incomeType: data.incomeType as "SALARY" | "HDFC" | "CANARA" | "GOLD" | "PF" | "OTHER",
        }),
        ...(data.isReceived !== undefined && { isReceived: Boolean(data.isReceived) }),
      });
      if (!result) throw new Error("Item not found");
      return result;
    }
    case "subscription": {
      const result = await updateForUser("subscription", userId, id, {
        ...(data.name !== undefined && { name: String(data.name) }),
        ...(data.amount !== undefined && { amount: Number(data.amount) }),
        ...(data.renewalDay !== undefined && { renewalDay: Number(data.renewalDay) }),
      });
      if (!result) throw new Error("Item not found");
      return result;
    }
    case "insurance": {
      const paymentStatus = data.paymentStatus as PaymentStatus | undefined;
      const result = await updateForUser("insurance", userId, id, {
        ...(data.name !== undefined && { name: String(data.name) }),
        ...(data.amount !== undefined && { premium: Number(data.amount) }),
        ...(data.payableAmount !== undefined && { payableAmount: Number(data.payableAmount) }),
        ...(data.renewalDay !== undefined && { renewalDay: Number(data.renewalDay) }),
        ...(data.insuranceType !== undefined && { insuranceType: data.insuranceType }),
        ...(paymentStatus !== undefined && { paymentStatus }),
        ...(paymentStatus === "PAID" && { payableAmount: 0 }),
      });
      if (!result) throw new Error("Item not found");
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

    switch (type) {
      case "saving":
        return prisma.saving.create({
          data: {
            userId,
            name,
            type: (data.savingType as "SIP" | "GOLD" | "PF" | "OTHER") || "SIP",
            amount,
            payableAmount,
            paymentStatus,
            isPayable: payableAmount > 0,
          },
        });
      case "loan": {
        const loanType = parseLoanType(data.loanType) || "PERSONAL";
        return prisma.loan.create({
          data: {
            userId,
            name,
            emiAmount: Number(data.emiAmount ?? data.amount) || 0,
            outstanding: Number(data.outstanding) || 0,
            pendingEmi: Number(data.pendingEmi) || 12,
            emiDate: Number(data.emiDate) || 5,
            interestRate: Number(data.interestRate) || 12,
            payableAmount,
            paymentStatus,
            loanType,
          },
        });
      }
      case "home":
        return prisma.fixedExpense.create({
          data: {
            userId,
            name,
            amount,
            payableAmount,
            paymentStatus,
            dueDay: Number(data.dueDay) || 1,
            category: "HOME",
            isPayable: payableAmount > 0,
          },
        });
      case "monthly_fixed":
        return prisma.fixedExpense.create({
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
      case "income": {
        const date = new Date();
        const month = Number(data.month) || date.getMonth() + 1;
        const year = Number(data.year) || date.getFullYear();
        return prisma.income.create({
          data: {
            userId,
            source: name,
            amount,
            incomeType: (data.incomeType as "SALARY" | "OTHER") || "OTHER",
            isReceived: data.isReceived !== undefined ? Boolean(data.isReceived) : false,
            month,
            year,
            date,
          },
        });
      }
      case "subscription":
        return prisma.subscription.create({
          data: {
            userId,
            name,
            amount,
            renewalDay: Number(data.renewalDay) || 1,
            isActive: true,
          },
        });
      case "insurance":
        return prisma.insurance.create({
          data: {
            userId,
            name,
            premium: amount,
            payableAmount,
            paymentStatus,
            renewalDay: Number(data.renewalDay) || 1,
            insuranceType: (data.insuranceType as "MEDICAL" | "OTHER") || "MEDICAL",
            cycle: "MONTHLY",
            isActive: true,
          },
        });
      default:
        throw new Error(`Cannot create item type: ${type}`);
    }
  } catch (err) {
    throw new Error(formatPrismaError(err));
  }
}

export async function deletePlanItem(
  userId: string,
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

  const deleted = await deleteForUser(model, userId, id);
  if (!deleted) throw new Error("Item not found");
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

  return prisma.budget.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: { userId, month, year, ...rest },
    update: rest,
  });
}

export { MONTHS, monthLabel };

// Backward compat alias
export async function getMonthlyPlanAnalysis(userId: string, month: number, year: number) {
  return getExcelMonthlyPlan(userId, month, year);
}
