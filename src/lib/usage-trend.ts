import prisma from "@/lib/db";
import { decimalToNumber, getCurrentMonthYear, getSalaryCycleDates } from "@/lib/utils";

export type UsageTrendPeriod =
  | "this_month"
  | "salary_cycle"
  | "last_3_months"
  | "last_6_months"
  | "this_year"
  | "all";

export interface ClassTotals {
  NEED: number;
  WANT: number;
  LUXURY: number;
  SAVINGS: number;
  total: number;
}

export interface UsageTrendPoint extends ClassTotals {
  label: string;
}

export interface UsageTrendData {
  period: UsageTrendPeriod;
  periodLabel: string;
  points: UsageTrendPoint[];
  consolidated: ClassTotals;
  isConsolidated: boolean;
}

const CLASSES = ["NEED", "WANT", "LUXURY", "SAVINGS"] as const;

function emptyTotals(): ClassTotals {
  return { NEED: 0, WANT: 0, LUXURY: 0, SAVINGS: 0, total: 0 };
}

function addToTotals(totals: ClassTotals, classification: string, amount: number) {
  const key = classification as keyof Omit<ClassTotals, "total">;
  if (CLASSES.includes(key as (typeof CLASSES)[number])) {
    totals[key] += amount;
    totals.total += amount;
  }
}

function formatMonthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getMonthBuckets(count: number, ref = new Date()) {
  const buckets: { year: number; month: number; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    buckets.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: formatMonthLabel(d.getFullYear(), d.getMonth() + 1),
    });
  }
  return buckets;
}

function getYearMonthBuckets(year: number) {
  const { month: currentMonth } = getCurrentMonthYear();
  const endMonth = year === new Date().getFullYear() ? currentMonth : 12;
  return Array.from({ length: endMonth }, (_, i) => ({
    year,
    month: i + 1,
    label: formatMonthLabel(year, i + 1),
  }));
}

function getDateRange(
  period: UsageTrendPeriod,
  salaryDay: number
): { start?: Date; end?: Date; periodLabel: string } {
  const now = new Date();
  const { month, year } = getCurrentMonthYear();

  switch (period) {
    case "this_month":
      return {
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0, 23, 59, 59),
        periodLabel: formatMonthLabel(year, month),
      };
    case "salary_cycle": {
      const { cycleStart, cycleEnd } = getSalaryCycleDates(salaryDay, now);
      return {
        start: cycleStart,
        end: new Date(cycleEnd.getFullYear(), cycleEnd.getMonth(), cycleEnd.getDate(), 23, 59, 59),
        periodLabel: `${formatDayLabel(cycleStart)} → ${formatDayLabel(cycleEnd)}`,
      };
    }
    case "last_3_months": {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return {
        start,
        end: now,
        periodLabel: "Last 3 Months",
      };
    }
    case "last_6_months": {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return {
        start,
        end: now,
        periodLabel: "Last 6 Months",
      };
    }
    case "this_year":
      return {
        start: new Date(year, 0, 1),
        end: now,
        periodLabel: String(year),
      };
    case "all":
      return { periodLabel: "All Time (Consolidated)" };
  }
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface ExpenseTrendRow {
  classification: string;
  amount: Parameters<typeof decimalToNumber>[0];
  date: Date;
  month: number;
  year: number;
}

function buildDailyPoints(
  expenses: Pick<ExpenseTrendRow, "classification" | "amount" | "date">[],
  start: Date,
  end: Date
): UsageTrendPoint[] {
  const map = new Map<string, ClassTotals>();

  for (const exp of expenses) {
    const dayKey = localDayKey(new Date(exp.date));
    if (!map.has(dayKey)) map.set(dayKey, emptyTotals());
    addToTotals(map.get(dayKey)!, exp.classification, decimalToNumber(exp.amount));
  }

  const points: UsageTrendPoint[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);

  while (cursor <= endDay) {
    const key = localDayKey(cursor);
    const totals = map.get(key) ?? emptyTotals();
    if (totals.total > 0) {
      points.push({ label: formatDayLabel(cursor), ...totals });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
}

function buildMonthlyPoints(
  expenses: Pick<ExpenseTrendRow, "classification" | "amount" | "month" | "year">[],
  buckets: { year: number; month: number; label: string }[]
): UsageTrendPoint[] {
  const map = new Map<string, ClassTotals>();
  for (const b of buckets) {
    map.set(`${b.year}-${b.month}`, emptyTotals());
  }

  for (const exp of expenses) {
    const key = `${exp.year}-${exp.month}`;
    if (!map.has(key)) map.set(key, emptyTotals());
    addToTotals(map.get(key)!, exp.classification, decimalToNumber(exp.amount));
  }

  return buckets.map((b) => ({
    label: b.label,
    ...(map.get(`${b.year}-${b.month}`) ?? emptyTotals()),
  }));
}

export async function getUsageTrend(
  userId: string,
  period: UsageTrendPeriod,
  salaryDay = 7
): Promise<UsageTrendData> {
  const { start, end, periodLabel } = getDateRange(period, salaryDay);

  const where =
    start && end
      ? { userId, date: { gte: start, lte: end } }
      : { userId };

  const expenses = await prisma.expense.findMany({
    where,
    select: { classification: true, amount: true, date: true, month: true, year: true },
    orderBy: { date: "asc" },
  });

  const consolidated = emptyTotals();
  for (const exp of expenses) {
    addToTotals(consolidated, exp.classification, decimalToNumber(exp.amount));
  }

  if (period === "all") {
    return {
      period,
      periodLabel,
      points: [],
      consolidated,
      isConsolidated: true,
    };
  }

  let points: UsageTrendPoint[] = [];

  if (period === "this_month" || period === "salary_cycle") {
    points = buildDailyPoints(expenses, start!, end!);
    if (points.length === 0 && consolidated.total > 0) {
      points = [{ label: periodLabel, ...consolidated }];
    }
  } else if (period === "last_3_months") {
    points = buildMonthlyPoints(expenses, getMonthBuckets(3));
  } else if (period === "last_6_months") {
    points = buildMonthlyPoints(expenses, getMonthBuckets(6));
  } else if (period === "this_year") {
    points = buildMonthlyPoints(expenses, getYearMonthBuckets(new Date().getFullYear()));
  }

  return {
    period,
    periodLabel,
    points,
    consolidated,
    isConsolidated: false,
  };
}
