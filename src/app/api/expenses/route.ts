import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { getCurrentMonthYear } from "@/lib/utils";
import { deleteForUser } from "@/lib/prisma-helpers";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const { month, year } = getCurrentMonthYear();

  const expenses = await prisma.expense.findMany({
    where: {
      userId: session.userId,
      month: parseInt(searchParams.get("month") || String(month)),
      year: parseInt(searchParams.get("year") || String(year)),
    },
    include: { category: true },
    orderBy: { date: "desc" },
  });

  return jsonOk(expenses);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const date = body.date ? new Date(body.date) : new Date();

  const expense = await prisma.expense.create({
    data: {
      userId: session.userId,
      amount: body.amount,
      merchant: body.merchant,
      categoryId: body.categoryId,
      classification: body.classification || "NEED",
      paymentMethod: body.paymentMethod || "UPI",
      notes: body.notes,
      date,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    },
    include: { category: true },
  });

  return jsonOk(expense, 201);
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("ID required");

  const deleted = await deleteForUser("expense", session.userId, id);
  if (!deleted) return jsonError("Expense not found", 404);
  return jsonOk({ success: true });
}
