import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { getCurrentMonthYear, decimalToNumber } from "@/lib/utils";
import { deleteForUser } from "@/lib/prisma-helpers";
import { applyExpenseToSource, reverseExpenseFromSource } from "@/lib/account-ledger";
import { isBankPayment } from "@/lib/constants";
import {
  EXPENSE_AREAS,
  getExpenseAreaMeta,
  resolveExpenseArea,
} from "@/lib/expense-areas";
import { remapExpenseMerchants } from "@/lib/expense-merchant-remap";
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
  const { month: curMonth, year: curYear } = getCurrentMonthYear();
  const month = parseInt(searchParams.get("month") || String(curMonth));
  const year = parseInt(searchParams.get("year") || String(curYear));

  // Remap free-text merchants → areas (non-fatal — never block listing)
  if (searchParams.get("remap") === "1") {
    try {
      const result = await remapExpenseMerchants(session.userId);
      return jsonOk(result);
    } catch (err) {
      console.error("Merchant remap failed:", err);
      return jsonError("Merchant remap failed", 500);
    }
  }

  try {
    await remapExpenseMerchants(session.userId);
  } catch (err) {
    console.error("Merchant remap skipped (expenses still returned):", err);
  }

  const [expenses, dhanuCandidates] = await Promise.all([
    prisma.expense.findMany({
      where: { userId: session.userId, month, year },
      include: expenseInclude,
      orderBy: { date: "desc" },
    }),
    prisma.fixedExpense.findMany({
      where: {
        userId: session.userId,
        name: { contains: "Dhanu Expense", mode: "insensitive" },
      },
    }),
  ]);

  const byMerchantMap = new Map<string, number>();
  for (const area of EXPENSE_AREAS) byMerchantMap.set(area.name, 0);
  for (const exp of expenses) {
    const area = resolveExpenseArea(exp.merchant, exp.notes, exp.category?.name);
    byMerchantMap.set(area, (byMerchantMap.get(area) || 0) + decimalToNumber(exp.amount));
  }
  const byMerchant = EXPENSE_AREAS.map((a) => ({
    name: a.name,
    icon: a.icon,
    amount: byMerchantMap.get(a.name) || 0,
  }));

  const dhanu =
    dhanuCandidates.find((f) => f.category === "HOME") ||
    dhanuCandidates.find((f) => f.category !== "MONTHLY_FIXED") ||
    dhanuCandidates[0] ||
    null;

  let plannedAmount = 0;
  if (dhanu) {
    const templateAmount = Number(dhanu.amount) || 0;
    const monthRows = await prisma.planMonthPayment.findMany({
      where: {
        userId: session.userId,
        month,
        year,
        sourceId: dhanu.id,
      },
    });
    const homeRow =
      monthRows.find((r) => r.sourceType === "HOME") || monthRows[0] || null;
    const monthAmount = homeRow ? Number(homeRow.amount) || 0 : 0;
    plannedAmount = monthAmount > 0 ? monthAmount : templateAmount;

    if (homeRow && monthAmount <= 0 && templateAmount > 0) {
      await prisma.planMonthPayment.update({
        where: { id: homeRow.id },
        data: { amount: templateAmount },
      });
      plannedAmount = templateAmount;
    }
  }

  return jsonOk({
    expenses,
    byMerchant,
    plannedExpense: {
      name: dhanu?.name || "Dhanu Expense",
      amount: plannedAmount,
      sourceId: dhanu?.id || null,
    },
  });
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

  const rawMerchant = String(body.merchant || "").trim();
  const merchantDetail = body.merchantDetail
    ? String(body.merchantDetail).trim()
    : null;
  const area = resolveExpenseArea(rawMerchant, body.notes, null);
  const areaMeta = getExpenseAreaMeta(area);
  const classification =
    body.classification || areaMeta.classification || "NEED";

  const expense = await prisma.expense.create({
    data: {
      userId: session.userId,
      amount,
      merchant: area,
      merchantDetail:
        merchantDetail ||
        (rawMerchant && rawMerchant.toLowerCase() !== area.toLowerCase()
          ? rawMerchant
          : null),
      categoryId: body.categoryId,
      classification,
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
  if (rest.merchant !== undefined) {
    const raw = String(rest.merchant).trim();
    const area = resolveExpenseArea(raw, rest.notes ?? existing.notes, null);
    data.merchant = area;
    if (rest.merchantDetail !== undefined) {
      data.merchantDetail = rest.merchantDetail
        ? String(rest.merchantDetail).trim()
        : null;
    } else if (raw && raw.toLowerCase() !== area.toLowerCase() && !existing.merchantDetail) {
      data.merchantDetail = raw;
    }
  }
  if (rest.merchantDetail !== undefined && rest.merchant === undefined) {
    data.merchantDetail = rest.merchantDetail
      ? String(rest.merchantDetail).trim()
      : null;
  }
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
