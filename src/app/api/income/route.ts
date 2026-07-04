import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { updateForUser, deleteForUser } from "@/lib/prisma-helpers";
import { applyIncomeToAccount, reverseIncomeFromAccount } from "@/lib/account-ledger";
import type { IncomeType } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const incomes = await prisma.income.findMany({
    where: { userId: session.userId, month, year },
    include: { account: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });

  const total = incomes.reduce((s, i) => s + Number(i.amount), 0);
  return jsonOk({ incomes, total, month, year });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const source = String(body.source || body.name || "").trim();
  if (!source) return jsonError("Income source required");

  const amount = Number(body.amount) || 0;
  const date = body.date ? new Date(body.date) : new Date();
  const month = body.month ?? date.getMonth() + 1;
  const year = body.year ?? date.getFullYear();
  const creditAccount = body.creditAccount !== false;

  const income = await prisma.income.create({
    data: {
      userId: session.userId,
      source,
      incomeType: (body.incomeType || "OTHER") as IncomeType,
      amount,
      date,
      month,
      year,
      isRecurring: body.isRecurring ?? false,
      notes: body.notes || null,
    },
  });

  if (creditAccount && amount > 0) {
    try {
      const accountId = await applyIncomeToAccount({
        userId: session.userId,
        amount,
        accountId: body.accountId || null,
        refId: income.id,
        description: `Income: ${source}`,
      });
      if (accountId) {
        await prisma.income.update({
          where: { id: income.id },
          data: { accountId },
        });
      } else {
        await prisma.income.delete({ where: { id: income.id } });
        return jsonError("Could not credit bank account. Add a bank account under Profile → Bank Accounts.");
      }
    } catch (err) {
      await prisma.income.delete({ where: { id: income.id } });
      const message = err instanceof Error ? err.message : "Failed to credit bank account";
      return jsonError(message);
    }
  }

  const result = await prisma.income.findUnique({
    where: { id: income.id },
    include: { account: { select: { id: true, name: true } } },
  });

  return jsonOk(result, 201);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { id, ...rest } = body;
  if (!id) return jsonError("ID required");

  const data: Record<string, unknown> = {};
  if (rest.source !== undefined) data.source = String(rest.source).trim();
  if (rest.name !== undefined) data.source = String(rest.name).trim();
  if (rest.amount !== undefined) data.amount = Number(rest.amount);
  if (rest.incomeType !== undefined) data.incomeType = rest.incomeType;
  if (rest.isRecurring !== undefined) data.isRecurring = Boolean(rest.isRecurring);
  if (rest.notes !== undefined) data.notes = rest.notes || null;
  if (rest.date !== undefined) {
    const d = new Date(rest.date);
    data.date = d;
    data.month = d.getMonth() + 1;
    data.year = d.getFullYear();
  }

  const income = await updateForUser("income", session.userId, id, data);
  if (!income) return jsonError("Income not found", 404);
  return jsonOk(income);
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("ID required");

  const existing = await prisma.income.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return jsonError("Income not found", 404);

  if (existing.accountId && Number(existing.amount) > 0) {
    try {
      await reverseIncomeFromAccount({
        userId: session.userId,
        amount: Number(existing.amount),
        accountId: existing.accountId,
        refId: id,
      });
    } catch {
      return jsonError("Cannot delete — insufficient bank balance to reverse this income");
    }
  }

  const deleted = await deleteForUser("income", session.userId, id);
  if (!deleted) return jsonError("Income not found", 404);
  return jsonOk({ success: true });
}
