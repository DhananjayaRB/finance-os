import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { decimalToNumber } from "@/lib/utils";
import { ensureDefaultBankAccount } from "@/lib/account-ledger";

function serializeAccount(account: {
  id: string;
  userId: string;
  name: string;
  bankName: string | null;
  balance: unknown;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...account,
    balance: decimalToNumber(account.balance as string | number),
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  await ensureDefaultBankAccount(session.userId);

  const accounts = await prisma.account.findMany({
    where: { userId: session.userId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  const serialized = accounts.map(serializeAccount);
  const total = serialized.reduce((s, a) => s + a.balance, 0);
  return jsonOk({ accounts: serialized, total });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return jsonError("Account name required");

  const balance = Number(body.balance) || 0;
  const existingCount = await prisma.account.count({ where: { userId: session.userId } });
  const isPrimary = Boolean(body.isPrimary) || existingCount === 0;

  const existing = await prisma.account.findUnique({
    where: { userId_name: { userId: session.userId, name } },
  });
  if (existing) return jsonError("An account with this name already exists");

  const account = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.account.updateMany({
        where: { userId: session.userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const created = await tx.account.create({
      data: {
        userId: session.userId,
        name,
        bankName: body.bankName || null,
        balance,
        isPrimary,
      },
    });

    if (balance > 0) {
      await tx.accountTransaction.create({
        data: {
          userId: session.userId,
          accountId: created.id,
          type: "CREDIT",
          amount: balance,
          description: "Opening balance",
        },
      });
    }

    return created;
  });

  return jsonOk(serializeAccount(account), 201);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { id, name, bankName, balance, adjustment, description, isPrimary } = body;
  if (!id) return jsonError("ID required");

  const existing = await prisma.account.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return jsonError("Account not found", 404);

  if (name && name !== existing.name) {
    const duplicate = await prisma.account.findUnique({
      where: { userId_name: { userId: session.userId, name: String(name).trim() } },
    });
    if (duplicate) return jsonError("An account with this name already exists");
  }

  if (adjustment !== undefined && adjustment !== null) {
    const delta = Number(adjustment);
    if (delta === 0) return jsonError("Adjustment amount cannot be zero");

    const newBalance = Number(existing.balance) + delta;
    if (newBalance < 0) return jsonError("Balance cannot go below zero");

    const account = await prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(bankName !== undefined && { bankName: bankName || null }),
          ...(isPrimary !== undefined && { isPrimary: Boolean(isPrimary) }),
          balance: newBalance,
        },
      });

      await tx.accountTransaction.create({
        data: {
          userId: session.userId,
          accountId: id,
          type: delta > 0 ? "CREDIT" : "DEBIT",
          amount: Math.abs(delta),
          description: description || (delta > 0 ? "Balance added" : "Balance removed"),
        },
      });

      if (isPrimary) {
        await tx.account.updateMany({
          where: { userId: session.userId, isPrimary: true, id: { not: id } },
          data: { isPrimary: false },
        });
      }

      return updated;
    });

    return jsonOk(serializeAccount(account));
  }

  if (balance !== undefined) {
    const newBalance = Number(balance);
    if (newBalance < 0) return jsonError("Balance cannot be negative");

    const diff = newBalance - Number(existing.balance);
    const account = await prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(bankName !== undefined && { bankName: bankName || null }),
          ...(isPrimary !== undefined && { isPrimary: Boolean(isPrimary) }),
          balance: newBalance,
        },
      });

      if (diff !== 0) {
        await tx.accountTransaction.create({
          data: {
            userId: session.userId,
            accountId: id,
            type: diff > 0 ? "CREDIT" : "DEBIT",
            amount: Math.abs(diff),
            description: description || "Balance updated",
          },
        });
      }

      if (isPrimary) {
        await tx.account.updateMany({
          where: { userId: session.userId, isPrimary: true, id: { not: id } },
          data: { isPrimary: false },
        });
      }

      return updated;
    });

    return jsonOk(serializeAccount(account));
  }

  const account = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.account.updateMany({
        where: { userId: session.userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    return tx.account.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(bankName !== undefined && { bankName: bankName || null }),
        ...(isPrimary !== undefined && { isPrimary: Boolean(isPrimary) }),
      },
    });
  });

  return jsonOk(serializeAccount(account));
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("ID required");

  await prisma.accountTransaction.deleteMany({ where: { accountId: id, userId: session.userId } });
  const deleted = await prisma.account.deleteMany({ where: { id, userId: session.userId } });
  if (deleted.count === 0) return jsonError("Account not found", 404);
  return jsonOk({ success: true });
}
