import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { getCurrentMonthYear } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const { month: curMonth, year: curYear } = getCurrentMonthYear();
  const month = parseInt(searchParams.get("month") || String(curMonth));
  const year = parseInt(searchParams.get("year") || String(curYear));

  const budget = await prisma.budget.findUnique({
    where: { userId_year_month: { userId: session.userId, year, month } },
  });

  return jsonOk({
    budget: budget
      ? {
          needAmount: Number(budget.needAmount),
          wantAmount: Number(budget.wantAmount),
          luxuryAmount: Number(budget.luxuryAmount),
          totalIncome: Number(budget.totalIncome),
        }
      : {
          needAmount: 10000,
          wantAmount: 0,
          luxuryAmount: 0,
          totalIncome: 0,
        },
    month,
    year,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { month: curMonth, year: curYear } = getCurrentMonthYear();
  const month = Number(body.month) || curMonth;
  const year = Number(body.year) || curYear;

  const needAmount = body.needAmount !== undefined ? Number(body.needAmount) : undefined;
  const wantAmount = body.wantAmount !== undefined ? Number(body.wantAmount) : undefined;
  const luxuryAmount = body.luxuryAmount !== undefined ? Number(body.luxuryAmount) : undefined;

  const budget = await prisma.budget.upsert({
    where: { userId_year_month: { userId: session.userId, year, month } },
    create: {
      userId: session.userId,
      month,
      year,
      totalIncome: Number(body.totalIncome) || 0,
      needAmount: needAmount ?? 10000,
      wantAmount: wantAmount ?? 0,
      luxuryAmount: luxuryAmount ?? 0,
    },
    update: {
      ...(needAmount !== undefined && { needAmount }),
      ...(wantAmount !== undefined && { wantAmount }),
      ...(luxuryAmount !== undefined && { luxuryAmount }),
      ...(body.totalIncome !== undefined && { totalIncome: Number(body.totalIncome) }),
    },
  });

  return jsonOk({
    needAmount: Number(budget.needAmount),
    wantAmount: Number(budget.wantAmount),
    luxuryAmount: Number(budget.luxuryAmount),
    totalIncome: Number(budget.totalIncome),
  });
}
