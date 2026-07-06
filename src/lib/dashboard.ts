import prisma from "@/lib/db";
import {
  decimalToNumber,
  getCurrentMonthYear,
  calculateBudgetHealth,
  getYtdMonthsFromJuly,
  monthYearLabel,
} from "@/lib/utils";
import { getExcelMonthlyPlan } from "@/lib/monthly-plan";
import { buildPlanAlerts } from "@/lib/plan-alerts";
import { savingsNetFromEntries, sumByMonth } from "@/lib/ytd-tracker";

export async function getDashboardData(userId: string) {
  const { month, year } = getCurrentMonthYear();
  const now = new Date();
  const today = now.getDate();
  const ytdMonths = getYtdMonthsFromJuly(month, year);
  const ytdOr = ytdMonths.map((m) => ({ month: m.month, year: m.year }));

  const [
    user,
    accounts,
    incomes,
    expenses,
    ytdIncomes,
    ytdExpenses,
    ytdSavingEntries,
    loans,
    savings,
    investments,
    cashBoxes,
    budget,
    goals,
    dbNotifications,
    subscriptions,
    todayExpenses,
    monthlyPlan,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId, month, year } }),
    prisma.expense.findMany({ where: { userId, month, year } }),
    prisma.income.findMany({
      where: { userId, OR: ytdOr.length > 0 ? ytdOr : [{ month, year }] },
    }),
    prisma.expense.findMany({
      where: { userId, OR: ytdOr.length > 0 ? ytdOr : [{ month, year }] },
    }),
    prisma.savingEntry.findMany({
      where: { userId, OR: ytdOr.length > 0 ? ytdOr : [{ month, year }] },
    }),
    prisma.loan.findMany({ where: { userId, status: "ACTIVE" }, orderBy: { emiDate: "asc" } }),
    prisma.saving.findMany({ where: { userId } }),
    prisma.investment.findMany({ where: { userId } }),
    prisma.cashBox.findMany({ where: { userId } }),
    prisma.budget.findUnique({ where: { userId_year_month: { userId, year, month } } }),
    prisma.goal.findMany({ where: { userId, isCompleted: false }, take: 3 }),
    prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.subscription.findMany({ where: { userId, isActive: true } }),
    prisma.expense.findMany({
      where: {
        userId,
        date: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
      },
    }),
    getExcelMonthlyPlan(userId, month, year),
  ]);

  const salaryDay = user?.salaryDay ?? 7;
  const currentMonthIncome = incomes.reduce((s, i) => s + decimalToNumber(i.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + decimalToNumber(e.amount), 0);
  const currentMonthSavings = monthlyPlan.totals.savingsNetSaved;
  const subscriptionMonthly = subscriptions.reduce(
    (s, sub) => s + decimalToNumber(sub.amount),
    0
  );

  const incomeByMonth = sumByMonth(ytdIncomes, ytdMonths, (i) => decimalToNumber(i.amount));
  const expenseByMonth = sumByMonth(ytdExpenses, ytdMonths, (e) => decimalToNumber(e.amount));
  const savingsByMonth = ytdMonths.map(({ month: m, year: y, label }) => {
    const entries = ytdSavingEntries.filter((e) => e.month === m && e.year === y);
    return { month: m, year: y, label, total: savingsNetFromEntries(entries) };
  });
  const subscriptionByMonth = ytdMonths.map(({ month: m, year: y, label }) => ({
    month: m,
    year: y,
    label,
    total: subscriptionMonthly,
  }));

  const incomeYtd = incomeByMonth.reduce((s, m) => s + m.total, 0);
  const expenseYtd = expenseByMonth.reduce((s, m) => s + m.total, 0);
  const savingsYtd = savingsByMonth.reduce((s, m) => s + m.total, 0);
  const subscriptionYtd = subscriptionByMonth.reduce((s, m) => s + m.total, 0);

  const totalEmi = loans.reduce((s, l) => s + decimalToNumber(l.emiAmount), 0);
  const totalOutstanding = loans.reduce((s, l) => s + decimalToNumber(l.outstanding), 0);
  const totalSavings = savings.reduce((s, sv) => s + decimalToNumber(sv.amount), 0);
  const totalInvestments = investments.reduce((s, i) => s + decimalToNumber(i.amount), 0);
  const bankBalance = accounts.reduce((s, a) => s + decimalToNumber(a.balance), 0);
  const cashInHand = cashBoxes.reduce((s, c) => s + decimalToNumber(c.balance), 0);
  const todayExpenseTotal = todayExpenses.reduce((s, e) => s + decimalToNumber(e.amount), 0);

  const upcomingEmi = loans.find((l) => {
    const diff = l.emiDate - today;
    return diff >= 0 && diff <= 7;
  }) || loans[0];

  const budgetHealth = calculateBudgetHealth(
    currentMonthIncome,
    totalExpenses + totalEmi,
    decimalToNumber(budget?.totalIncome || currentMonthIncome)
  );

  const expenseByClass = expenses.reduce(
    (acc, e) => {
      acc[e.classification] = (acc[e.classification] || 0) + decimalToNumber(e.amount);
      return acc;
    },
    {} as Record<string, number>
  );

  const expenseByCategory = expenses.reduce(
    (acc, e) => {
      const key = e.merchant || "Others";
      acc[key] = (acc[key] || 0) + decimalToNumber(e.amount);
      return acc;
    },
    {} as Record<string, number>
  );

  const planAlerts = buildPlanAlerts(monthlyPlan);
  const planNotifications = planAlerts.map((a) => ({
    title: a.title,
    message: a.message,
    type: a.type.toUpperCase(),
    category: a.category,
  }));

  return {
    period: {
      month,
      year,
      label: monthYearLabel(month, year),
      salaryDay,
      ytdFrom: ytdMonths[0] ? monthYearLabel(ytdMonths[0].month, ytdMonths[0].year) : monthYearLabel(7, year),
    },
    tracks: {
      income: {
        current: currentMonthIncome,
        ytd: incomeYtd,
        byMonth: incomeByMonth,
      },
      expenses: {
        current: totalExpenses,
        ytd: expenseYtd,
        byMonth: expenseByMonth,
      },
      savings: {
        current: currentMonthSavings,
        ytd: savingsYtd,
        byMonth: savingsByMonth,
      },
      subscriptions: {
        current: subscriptionMonthly,
        ytd: subscriptionYtd,
        byMonth: subscriptionByMonth,
      },
    },
    summary: {
      todayBalance: bankBalance + cashInHand,
      income: currentMonthIncome,
      planIncome: monthlyPlan.income.planTotal,
      payable: monthlyPlan.totals.allPayable,
      required: monthlyPlan.totals.totalRequired,
      savingsThisMonth: currentMonthSavings,
      planBalance: monthlyPlan.totals.balance,
      expenses: totalExpenses,
      loans: totalEmi,
      totalOutstanding,
      savings: totalSavings,
      investments: totalInvestments,
      bankBalance,
      cashInHand,
      remaining: monthlyPlan.totals.balance,
      todayExpenses: todayExpenseTotal,
      subscriptionTotal: subscriptionMonthly,
      budgetHealth,
      incomeYtd,
      expenseYtd,
      savingsYtd,
      subscriptionYtd,
    },
    upcomingEmi: upcomingEmi
      ? {
          name: upcomingEmi.name,
          emiAmount: decimalToNumber(upcomingEmi.emiAmount),
          emiDate: upcomingEmi.emiDate,
        }
      : null,
    goals: goals.map((g) => ({
      name: g.name,
      targetAmount: decimalToNumber(g.targetAmount),
      currentAmount: decimalToNumber(g.currentAmount),
    })),
    notifications: [
      ...planNotifications,
      ...dbNotifications.map((n) => ({
        title: n.title,
        message: n.message,
        type: n.type,
        category: "general",
      })),
    ].slice(0, 15),
    monthlyPlan: {
      income: monthlyPlan.income.planTotal,
      payable: monthlyPlan.totals.allPayable,
      required: monthlyPlan.totals.totalRequired,
      savings: monthlyPlan.totals.savingsNetSaved,
      balance: monthlyPlan.totals.balance,
      bankBalance: monthlyPlan.consolidated.bankBalance,
      cashInHand: monthlyPlan.consolidated.cashInHand,
    },
    expenseByClass,
    expenseByCategory: Object.entries(expenseByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
  };
}

export async function getLoanPlannerData(userId: string) {
  const loans = await prisma.loan.findMany({
    where: { userId, status: "ACTIVE" },
    include: { payments: { orderBy: { date: "desc" }, take: 5 } },
    orderBy: { outstanding: "desc" },
  });

  return loans.map((loan) => ({
    ...loan,
    outstanding: decimalToNumber(loan.outstanding),
    emiAmount: decimalToNumber(loan.emiAmount),
    interestRate: decimalToNumber(loan.interestRate),
  }));
}
