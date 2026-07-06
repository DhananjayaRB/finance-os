import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { updateForUser, deleteForUser } from "@/lib/prisma-helpers";
import { decimalToNumber } from "@/lib/utils";
import type { SavingType } from "@/generated/prisma/client";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1));
    const year = parseInt(searchParams.get("year") || String(now.getFullYear()));

    const [entries, yearEntries, allEntries] = await Promise.all([
      prisma.savingEntry.findMany({
        where: { userId: session.userId, month, year },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
      prisma.savingEntry.findMany({
        where: { userId: session.userId, year },
        orderBy: { date: "asc" },
      }),
      prisma.savingEntry.findMany({
        where: { userId: session.userId },
        select: { amount: true, type: true },
      }),
    ]);

    const serialized = entries.map((e) => ({
      ...e,
      amount: decimalToNumber(e.amount),
    }));

    const monthTotal = serialized.reduce((s, e) => s + e.amount, 0);

    const yearByMonth = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const total = yearEntries
        .filter((e) => e.month === m)
        .reduce((s, e) => s + decimalToNumber(e.amount), 0);
      return { month: m, label: MONTHS[i], total };
    });

    const yearTotal = yearByMonth.reduce((s, m) => s + m.total, 0);

    const byTypeMap: Record<string, number> = {};
    for (const e of yearEntries) {
      const key = e.type;
      byTypeMap[key] = (byTypeMap[key] || 0) + decimalToNumber(e.amount);
    }
    const byType = Object.entries(byTypeMap)
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);

    const allTimeTotal = allEntries.reduce((s, e) => s + decimalToNumber(e.amount), 0);

    return jsonOk({
      entries: serialized,
      month,
      year,
      monthTotal,
      yearTotal,
      allTimeTotal,
      yearByMonth,
      byType,
    });
  } catch (err) {
    console.error("Savings GET failed:", err);
    return jsonError(
      err instanceof Error ? err.message : "Failed to load savings. Restart the dev server.",
      500
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return jsonError("Savings name required");

    const amount = Number(body.amount) || 0;
    if (amount <= 0) return jsonError("Amount must be greater than zero");

    const date = body.date ? new Date(body.date) : new Date();
    const month = body.month ?? date.getMonth() + 1;
    const year = body.year ?? date.getFullYear();

    const entry = await prisma.savingEntry.create({
      data: {
        userId: session.userId,
        name,
        type: (body.type || "SIP") as SavingType,
        amount,
        payableAmount: body.payableAmount !== undefined ? Number(body.payableAmount) : 0,
        paymentStatus: (body.paymentStatus || "PAID") as "PAID" | "PENDING" | "DUE" | "OVERDUE" | "CLOSED",
        dueDay: body.dueDay !== undefined ? Number(body.dueDay) : date.getDate(),
        date,
        month,
        year,
        notes: body.notes || null,
      },
    });

    return jsonOk({ ...entry, amount: decimalToNumber(entry.amount) }, 201);
  } catch (err) {
    console.error("Savings POST failed:", err);
    return jsonError(
      err instanceof Error ? err.message : "Failed to save. Restart the dev server and try again.",
      500
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { id, ...rest } = body;
  if (!id) return jsonError("ID required");

  const data: Record<string, unknown> = {};
  if (rest.name !== undefined) data.name = String(rest.name).trim();
  if (rest.type !== undefined) data.type = rest.type;
  if (rest.amount !== undefined) data.amount = Number(rest.amount);
  if (rest.payableAmount !== undefined) data.payableAmount = Number(rest.payableAmount);
  if (rest.paymentStatus !== undefined) data.paymentStatus = rest.paymentStatus;
  if (rest.dueDay !== undefined) data.dueDay = Number(rest.dueDay);
  if (rest.notes !== undefined) data.notes = rest.notes || null;
  if (rest.date !== undefined) {
    const d = new Date(rest.date);
    data.date = d;
    data.month = d.getMonth() + 1;
    data.year = d.getFullYear();
  }
  if (rest.month !== undefined) data.month = Number(rest.month);
  if (rest.year !== undefined) data.year = Number(rest.year);

  const entry = await updateForUser("savingEntry", session.userId, id, data);
  if (!entry) return jsonError("Savings entry not found", 404);
  return jsonOk(entry);
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("ID required");

  const deleted = await deleteForUser("savingEntry", session.userId, id);
  if (!deleted) return jsonError("Savings entry not found", 404);
  return jsonOk({ success: true });
}
