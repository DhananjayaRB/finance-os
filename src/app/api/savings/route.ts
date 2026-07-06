import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { updateForUser, deleteForUser } from "@/lib/prisma-helpers";
import { decimalToNumber } from "@/lib/utils";
import type { SavingEntryKind, SavingType } from "@/generated/prisma/client";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function netFromEntries(entries: { kind: string; amount: string | number | { toNumber?: () => number } }[]) {
  let deposited = 0;
  let withdrawn = 0;
  let missed = 0;
  for (const e of entries) {
    const amt = decimalToNumber(e.amount);
    if (e.kind === "WITHDRAWAL") withdrawn += amt;
    else if (e.kind === "MISSED") missed += amt;
    else deposited += amt;
  }
  return { deposited, withdrawn, missed, net: deposited - withdrawn };
}

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
        select: { kind: true, amount: true },
      }),
    ]);

    const serialized = entries.map((e) => ({
      ...e,
      amount: decimalToNumber(e.amount),
    }));

    const monthStats = netFromEntries(entries);
    const yearStats = netFromEntries(yearEntries);
    const allTimeStats = netFromEntries(allEntries);

    const yearByMonth = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthEntries = yearEntries.filter((e) => e.month === m);
      const total = netFromEntries(monthEntries).net;
      return { month: m, label: MONTHS[i], total };
    });

    const byTypeMap: Record<string, number> = {};
    for (const e of yearEntries) {
      const amt = decimalToNumber(e.amount);
      const signed =
        e.kind === "WITHDRAWAL" ? -amt : e.kind === "MISSED" ? 0 : amt;
      if (signed === 0) continue;
      byTypeMap[e.type] = (byTypeMap[e.type] || 0) + signed;
    }
    const byType = Object.entries(byTypeMap)
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);

    return jsonOk({
      entries: serialized,
      month,
      year,
      monthTotal: monthStats.net,
      monthDeposited: monthStats.deposited,
      monthWithdrawn: monthStats.withdrawn,
      monthMissed: monthStats.missed,
      yearTotal: yearStats.net,
      allTimeTotal: allTimeStats.net,
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

    const kind = (body.kind || "DEPOSIT") as SavingEntryKind;
    const paymentStatus =
      kind === "DEPOSIT"
        ? ((body.paymentStatus || "PAID") as "PAID" | "PENDING" | "DUE" | "OVERDUE" | "CLOSED")
        : "PAID";

    const entry = await prisma.savingEntry.create({
      data: {
        userId: session.userId,
        name,
        type: (body.type || "SIP") as SavingType,
        kind,
        amount,
        payableAmount:
          kind === "DEPOSIT" && body.payableAmount !== undefined
            ? Number(body.payableAmount)
            : 0,
        paymentStatus,
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

  const existing = await prisma.savingEntry.findFirst({
    where: { id, userId: session.userId },
    select: { kind: true },
  });
  if (!existing) return jsonError("Savings entry not found", 404);

  const data: Record<string, unknown> = {};
  if (rest.name !== undefined) data.name = String(rest.name).trim();
  if (rest.type !== undefined) data.type = rest.type;
  if (rest.kind !== undefined) data.kind = rest.kind;
  if (rest.amount !== undefined) data.amount = Number(rest.amount);

  const effectiveKind = (rest.kind as string) || existing.kind;
  if (effectiveKind === "DEPOSIT") {
    data.payableAmount = 0;
    data.paymentStatus = "PAID";
  } else {
    if (rest.payableAmount !== undefined) data.payableAmount = Number(rest.payableAmount);
    if (rest.paymentStatus !== undefined) data.paymentStatus = rest.paymentStatus;
  }
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
