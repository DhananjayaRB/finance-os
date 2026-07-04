import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { getCurrentMonthYear } from "@/lib/utils";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { month, year } = getCurrentMonthYear();
  const budget = await prisma.budget.findUnique({
    where: { userId_year_month: { userId: session.userId, year, month } },
  });

  const [fixedExpenses, subscriptions, savings, incomes] = await Promise.all([
    prisma.fixedExpense.findMany({ where: { userId: session.userId } }),
    prisma.subscription.findMany({ where: { userId: session.userId, isActive: true } }),
    prisma.saving.findMany({ where: { userId: session.userId } }),
    prisma.income.findMany({ where: { userId: session.userId, month, year } }),
  ]);

  return jsonOk({ budget, fixedExpenses, subscriptions, savings, incomes });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { month, year } = getCurrentMonthYear();

  const budget = await prisma.budget.upsert({
    where: { userId_year_month: { userId: session.userId, year, month } },
    create: { userId: session.userId, month, year, totalIncome: body.totalIncome || 0, ...body },
    update: body,
  });

  return jsonOk(budget);
}
