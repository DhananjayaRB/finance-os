import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { getCurrentMonthYear } from "@/lib/utils";
import { deleteForUser } from "@/lib/prisma-helpers";
import { applyExpenseToSource, reverseExpenseFromSource } from "@/lib/account-ledger";
import { isBankPayment } from "@/lib/constants";
import type { ExpenseClass, PaymentMethod } from "@/generated/prisma/client";

const expenseInclude = {
  category: true,
  account: { select: { id: true, name: true } },
  cashBox: { select: { id: true, name: true } },
} as const;

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
    include: expenseInclude,
    orderBy: { date: "desc" },
  });

  return jsonOk(expenses);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const date = body.date ? new Date(body.date) : new Date();
  const amount = Number(body.amount) || 0;
  const paymentMethod = body.paymentMethod || "UPI";
  const debitSource = body.debitSource !== false;

  let accountId: string | undefined;
  let cashBoxId: string | undefined;

  if (debitSource && amount > 0) {
    try {
      const result = await applyExpenseToSource({
        userId: session.userId,
        amount,
        paymentMethod,
        accountId: body.accountId || null,
        cashBoxId: body.cashBoxId || null,
        refId: "pending",
        description: body.merchant ? `Expense: ${body.merchant}` : "Expense",
      });
      accountId = result?.accountId;
      cashBoxId = result?.cashBoxId;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to debit payment source";
      return jsonError(message);
    }
  }

  const expense = await prisma.expense.create({
    data: {
      userId: session.userId,
      amount,
      merchant: body.merchant,
      categoryId: body.categoryId,
      classification: body.classification || "NEED",
      paymentMethod,
      accountId: accountId || body.accountId || null,
      cashBoxId: cashBoxId || body.cashBoxId || null,
      notes: body.notes,
      date,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    },
    include: expenseInclude,
  });

  return jsonOk(expense, 201);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { id, ...rest } = body;
  if (!id) return jsonError("ID required");

  const existing = await prisma.expense.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return jsonError("Expense not found", 404);

  const newAmount = rest.amount !== undefined ? Number(rest.amount) : Number(existing.amount);
  if (newAmount <= 0) return jsonError("Amount must be greater than zero");

  const newPaymentMethod = (rest.paymentMethod ?? existing.paymentMethod) as PaymentMethod;
  const newMerchant = rest.merchant !== undefined ? rest.merchant : existing.merchant;
  const requestedAccountId =
    rest.accountId !== undefined ? (rest.accountId || null) : existing.accountId;
  const requestedCashBoxId =
    rest.cashBoxId !== undefined ? (rest.cashBoxId || null) : existing.cashBoxId;
  const debitSource = rest.debitSource !== false;

  const hadLedger =
    Number(existing.amount) > 0 &&
    (existing.paymentMethod === "CASH" ||
      (existing.accountId && isBankPayment(existing.paymentMethod)));

  if (hadLedger) {
    try {
      await reverseExpenseFromSource({
        userId: session.userId,
        amount: Number(existing.amount),
        paymentMethod: existing.paymentMethod,
        accountId: existing.accountId,
        cashBoxId: existing.cashBoxId,
        refId: id,
        description: `Expense edit reversal: ${existing.merchant || "Expense"}`,
      });
    } catch {
      return jsonError("Cannot edit — insufficient balance to adjust ledger");
    }
  }

  let accountId: string | null = requestedAccountId;
  let cashBoxId: string | null = requestedCashBoxId;

  if (debitSource && newAmount > 0) {
    try {
      const result = await applyExpenseToSource({
        userId: session.userId,
        amount: newAmount,
        paymentMethod: newPaymentMethod,
        accountId: requestedAccountId,
        cashBoxId: requestedCashBoxId,
        refId: id,
        description: newMerchant ? `Expense: ${newMerchant}` : "Expense",
      });
      if (isBankPayment(newPaymentMethod)) {
        accountId = result?.accountId ?? requestedAccountId;
        cashBoxId = null;
      } else if (newPaymentMethod === "CASH") {
        cashBoxId = result?.cashBoxId ?? requestedCashBoxId;
        accountId = null;
      } else {
        accountId = null;
        cashBoxId = null;
      }
    } catch (err) {
      if (hadLedger) {
        await applyExpenseToSource({
          userId: session.userId,
          amount: Number(existing.amount),
          paymentMethod: existing.paymentMethod,
          accountId: existing.accountId,
          cashBoxId: existing.cashBoxId,
          refId: id,
          description: existing.merchant ? `Expense: ${existing.merchant}` : "Expense",
        }).catch(() => undefined);
      }
      const message = err instanceof Error ? err.message : "Failed to debit payment source";
      return jsonError(message);
    }
  } else {
    accountId = null;
    cashBoxId = null;
  }

  const data: Record<string, unknown> = { accountId, cashBoxId };
  if (rest.merchant !== undefined) data.merchant = String(rest.merchant).trim() || null;
  if (rest.amount !== undefined) data.amount = newAmount;
  if (rest.classification !== undefined) data.classification = rest.classification as ExpenseClass;
  if (rest.paymentMethod !== undefined) data.paymentMethod = newPaymentMethod;
  if (rest.notes !== undefined) data.notes = rest.notes ? String(rest.notes).trim() : null;
  if (rest.date !== undefined) {
    const d = new Date(rest.date);
    data.date = d;
    data.month = d.getMonth() + 1;
    data.year = d.getFullYear();
  }

  const expense = await prisma.expense.update({
    where: { id },
    data,
    include: expenseInclude,
  });

  return jsonOk(expense);
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("ID required");

  const existing = await prisma.expense.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return jsonError("Expense not found", 404);

  try {
    await reverseExpenseFromSource({
      userId: session.userId,
      amount: Number(existing.amount),
      paymentMethod: existing.paymentMethod,
      accountId: existing.accountId,
      cashBoxId: existing.cashBoxId,
      refId: id,
    });
  } catch {
    return jsonError("Cannot delete — insufficient balance to reverse this expense");
  }

  const deleted = await deleteForUser("expense", session.userId, id);
  if (!deleted) return jsonError("Expense not found", 404);
  return jsonOk({ success: true });
}
