import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import {
  getExcelMonthlyPlan,
  copyPlanFromPreviousMonth,
  markItemPaid,
  updatePlanItem,
  createPlanItem,
  deletePlanItem,
  updatePlanSummary,
  type PlanItemType,
} from "@/lib/monthly-plan";
import { getCurrentMonthYear } from "@/lib/utils";
import { formatPrismaError } from "@/lib/prisma-errors";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const { month: curMonth, year: curYear } = getCurrentMonthYear();
  const month = parseInt(searchParams.get("month") || String(curMonth));
  const year = parseInt(searchParams.get("year") || String(curYear));

  try {
    const data = await getExcelMonthlyPlan(session.userId, month, year);
    return jsonOk(data);
  } catch (err) {
    console.error("Plan load failed:", err);
    const message = err instanceof Error ? err.message : "Failed to load monthly plan";
    return jsonError(message, 500);
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const month = body.month ?? getCurrentMonthYear().month;
  const year = body.year ?? getCurrentMonthYear().year;

  const budget = await prisma.budget.upsert({
    where: { userId_year_month: { userId: session.userId, year, month } },
    create: {
      userId: session.userId,
      month,
      year,
      totalIncome: body.totalIncome ?? 135000,
      emiAmount: body.emiAmount ?? 79618,
      fixedExpense: body.fixedExpense ?? 50000,
      subscriptionAmount: body.subscriptionAmount ?? 4550,
      needAmount: body.needAmount ?? 68000,
      wantAmount: body.wantAmount ?? 15000,
      luxuryAmount: body.luxuryAmount ?? 7000,
      savingsAmount: body.savingsAmount ?? 5000,
      investmentAmount: body.investmentAmount ?? 10000,
      carryForward: body.carryForward ?? 382,
    },
    update: body,
  });

  const analysis = await getExcelMonthlyPlan(session.userId, month, year);
  return jsonOk({ budget, analysis });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const month = body.month ?? getCurrentMonthYear().month;
  const year = body.year ?? getCurrentMonthYear().year;

  if (body.action === "copy_previous") {
    const copied = await copyPlanFromPreviousMonth(session.userId, month, year);
    if (!copied) return jsonError("No previous month plan found", 404);
    const analysis = await getExcelMonthlyPlan(session.userId, month, year);
    return jsonOk({ budget: copied, analysis });
  }

  if (body.action === "mark_paid") {
    const { type, id } = body;
    if (!type || !id) return jsonError("type and id required");
    try {
      const updated = await markItemPaid(session.userId, type, id);
      if (!updated) return jsonError("Item not found", 404);
      const analysis = await getExcelMonthlyPlan(session.userId, month, year);
      return jsonOk(analysis);
    } catch (err) {
      console.error("mark_paid failed:", err);
      return jsonError(formatPrismaError(err), 500);
    }
  }

  if (body.action === "reset_template") {
    const { seedExcelTemplate } = await import("@/lib/seed-excel-template");
    await seedExcelTemplate(session.userId, month, year);
    const analysis = await getExcelMonthlyPlan(session.userId, month, year);
    return jsonOk(analysis);
  }

  if (body.action === "update_item") {
    const { type, id, data } = body;
    if (!type || !id) return jsonError("type and id required");
    try {
      await updatePlanItem(session.userId, type as PlanItemType, id, data ?? {});
      const analysis = await getExcelMonthlyPlan(session.userId, month, year);
      return jsonOk(analysis);
    } catch (err) {
      console.error("update_item failed:", err);
      return jsonError(formatPrismaError(err), 500);
    }
  }

  if (body.action === "create_item") {
    const { type, data } = body;
    if (!type) return jsonError("type required");
    try {
      await createPlanItem(session.userId, type as PlanItemType, data ?? {});
      const analysis = await getExcelMonthlyPlan(session.userId, month, year);
      return jsonOk(analysis);
    } catch (err) {
      console.error("create_item failed:", err);
      return jsonError(formatPrismaError(err), 500);
    }
  }

  if (body.action === "delete_item") {
    const { type, id } = body;
    if (!type || !id) return jsonError("type and id required");
    try {
      await deletePlanItem(session.userId, type as PlanItemType, id);
      const analysis = await getExcelMonthlyPlan(session.userId, month, year);
      return jsonOk(analysis);
    } catch (err) {
      console.error("delete_item failed:", err);
      return jsonError(formatPrismaError(err), 500);
    }
  }

  if (body.action === "update_plan_income") {
    const planIncome = Number(body.planIncome);
    if (!planIncome) return jsonError("planIncome required");
    await updatePlanSummary(session.userId, month, year, planIncome);
    const analysis = await getExcelMonthlyPlan(session.userId, month, year);
    return jsonOk(analysis);
  }

  return jsonError("Unknown action", 400);
}
