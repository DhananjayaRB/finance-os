import prisma from "@/lib/db";
import { decimalToNumber, getCurrentMonthYear, calculateBudgetHealth } from "@/lib/utils";

export async function getDashboardData(userId: string) {
  const { month, year } = getCurrentMonthYear();
  const now = new Date();
  const today = now.getDate();

  const [
    user,
    accounts,
    incomes,
    expenses,
    loans,
    savings,
    investments,
    cashBoxes,
    budget,
    goals,
    notifications,
    subscriptions,
    todayExpenses,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId, month, year } }),
    prisma.expense.findMany({ where: { userId, month, year } }),
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
  ]);

  const totalIncome = incomes.reduce((s, i) => s + decimalToNumber(i.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + decimalToNumber(e.amount), 0);
  const totalEmi = loans.reduce((s, l) => s + decimalToNumber(l.emiAmount), 0);
  const totalOutstanding = loans.reduce((s, l) => s + decimalToNumber(l.outstanding), 0);
  const totalSavings = savings.reduce((s, sv) => s + decimalToNumber(sv.amount), 0);
  const totalInvestments = investments.reduce((s, i) => s + decimalToNumber(i.amount), 0);
  const bankBalance = accounts.reduce((s, a) => s + decimalToNumber(a.balance), 0);
  const cashInHand = cashBoxes.reduce((s, c) => s + decimalToNumber(c.balance), 0);
  const todayExpenseTotal = todayExpenses.reduce((s, e) => s + decimalToNumber(e.amount), 0);
  const subscriptionTotal = subscriptions.reduce((s, sub) => s + decimalToNumber(sub.amount), 0);

  const upcomingEmi = loans.find((l) => {
    const diff = l.emiDate - today;
    return diff >= 0 && diff <= 7;
  }) || loans[0];

  const remaining = totalIncome - totalExpenses - totalEmi;
  const budgetHealth = calculateBudgetHealth(
    totalIncome,
    totalExpenses + totalEmi,
    decimalToNumber(budget?.totalIncome || totalIncome)
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

  return {
    summary: {
      todayBalance: bankBalance + cashInHand,
      income: totalIncome,
      expenses: totalExpenses,
      loans: totalEmi,
      totalOutstanding,
      savings: totalSavings,
      investments: totalInvestments,
      bankBalance,
      cashInHand,
      remaining,
      todayExpenses: todayExpenseTotal,
      subscriptionTotal,
      budgetHealth,
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
    notifications: notifications.map((n) => ({
      title: n.title,
      message: n.message,
      type: n.type,
    })),
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
