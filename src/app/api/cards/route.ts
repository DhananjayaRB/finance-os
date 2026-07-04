import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { updateForUser } from "@/lib/prisma-helpers";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const cards = await prisma.creditCard.findMany({
    where: { userId: session.userId, isActive: true },
    orderBy: { name: "asc" },
  });

  return jsonOk(cards);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return jsonError("Card name required");

  const card = await prisma.creditCard.create({
    data: {
      userId: session.userId,
      name,
      limit: Number(body.limit) || 0,
      used: Number(body.used) || 0,
      statementDay: body.statementDay != null ? Number(body.statementDay) : null,
      dueDay: body.dueDay != null ? Number(body.dueDay) : null,
      minimumDue: body.minimumDue != null ? Number(body.minimumDue) : null,
      rewardPoints: Number(body.rewardPoints) || 0,
      annualFee: body.annualFee != null ? Number(body.annualFee) : null,
    },
  });

  return jsonOk(card, 201);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { id, name, limit, used, statementDay, dueDay, minimumDue, rewardPoints, annualFee } = body;
  if (!id) return jsonError("ID required");

  const card = await updateForUser("creditCard", session.userId, id, {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(limit !== undefined && { limit: Number(limit) }),
      ...(used !== undefined && { used: Number(used) }),
      ...(statementDay !== undefined && { statementDay: statementDay ? Number(statementDay) : null }),
      ...(dueDay !== undefined && { dueDay: dueDay ? Number(dueDay) : null }),
      ...(minimumDue !== undefined && { minimumDue: minimumDue ? Number(minimumDue) : null }),
      ...(rewardPoints !== undefined && { rewardPoints: Number(rewardPoints) }),
      ...(annualFee !== undefined && { annualFee: annualFee ? Number(annualFee) : null }),
  });

  if (!card) return jsonError("Card not found", 404);
  return jsonOk(card);
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("ID required");

  const card = await updateForUser("creditCard", session.userId, id, { isActive: false });
  if (!card) return jsonError("Card not found", 404);
  return jsonOk({ success: true });
}
