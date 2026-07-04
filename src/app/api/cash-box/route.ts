import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import type { CashBoxType, CashTransactionType } from "@/generated/prisma/client";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const boxes = await prisma.cashBox.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
  });

  return jsonOk(boxes);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return jsonError("Name required");

  const balance = Number(body.balance) || 0;
  const type = (body.type || "CUSTOM") as CashBoxType;

  const existing = await prisma.cashBox.findUnique({
    where: { userId_name: { userId: session.userId, name } },
  });
  if (existing) return jsonError("A cash box with this name already exists");

  const box = await prisma.cashBox.create({
    data: {
      userId: session.userId,
      name,
      type,
      balance,
    },
  });

  if (balance > 0) {
    await prisma.cashTransaction.create({
      data: {
        userId: session.userId,
        cashBoxId: box.id,
        type: "CASH_IN",
        amount: balance,
        description: "Opening balance",
      },
    });
  }

  return jsonOk(box, 201);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { id, name, type, balance, adjustment, description } = body;
  if (!id) return jsonError("ID required");

  const existing = await prisma.cashBox.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return jsonError("Cash box not found", 404);

  if (name && name !== existing.name) {
    const duplicate = await prisma.cashBox.findUnique({
      where: { userId_name: { userId: session.userId, name: String(name).trim() } },
    });
    if (duplicate) return jsonError("A cash box with this name already exists");
  }

  if (adjustment !== undefined && adjustment !== null) {
    const delta = Number(adjustment);
    if (delta === 0) return jsonError("Adjustment amount cannot be zero");

    const txType: CashTransactionType = delta > 0 ? "CASH_IN" : "CASH_OUT";
    const newBalance = Number(existing.balance) + delta;
    if (newBalance < 0) return jsonError("Balance cannot go below zero");

    const [box] = await prisma.$transaction([
      prisma.cashBox.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(type !== undefined && { type: type as CashBoxType }),
          balance: newBalance,
        },
      }),
      prisma.cashTransaction.create({
        data: {
          userId: session.userId,
          cashBoxId: id,
          type: txType,
          amount: Math.abs(delta),
          description: description || (delta > 0 ? "Cash added" : "Cash removed"),
        },
      }),
    ]);

    return jsonOk(box);
  }

  if (balance !== undefined) {
    const newBalance = Number(balance);
    if (newBalance < 0) return jsonError("Balance cannot be negative");

    const diff = newBalance - Number(existing.balance);
    const box = await prisma.$transaction(async (tx) => {
      const updated = await tx.cashBox.update({
        where: { id },
        data: {
          ...(name !== undefined && { name: String(name).trim() }),
          ...(type !== undefined && { type: type as CashBoxType }),
          balance: newBalance,
        },
      });

      if (diff !== 0) {
        await tx.cashTransaction.create({
          data: {
            userId: session.userId,
            cashBoxId: id,
            type: diff > 0 ? "CASH_IN" : "CASH_OUT",
            amount: Math.abs(diff),
            description: description || "Balance updated",
          },
        });
      }

      return updated;
    });

    return jsonOk(box);
  }

  const box = await prisma.cashBox.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(type !== undefined && { type: type as CashBoxType }),
    },
  });

  return jsonOk(box);
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("ID required");

  await prisma.cashTransaction.deleteMany({ where: { cashBoxId: id, userId: session.userId } });
  const deleted = await prisma.cashBox.deleteMany({ where: { id, userId: session.userId } });
  if (deleted.count === 0) return jsonError("Cash box not found", 404);
  return jsonOk({ success: true });
}
