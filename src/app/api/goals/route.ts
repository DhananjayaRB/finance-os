import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { updateForUser, deleteForUser } from "@/lib/prisma-helpers";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const goals = await prisma.goal.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
  });

  return jsonOk(goals);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return jsonError("Goal name required");

  const goal = await prisma.goal.create({
    data: {
      userId: session.userId,
      name,
      targetAmount: Number(body.targetAmount) || 0,
      currentAmount: Number(body.currentAmount) || 0,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      icon: body.icon || null,
      isCompleted: Boolean(body.isCompleted),
    },
  });

  return jsonOk(goal, 201);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { id, name, targetAmount, currentAmount, targetDate, icon, isCompleted } = body;
  if (!id) return jsonError("ID required");

  const target = Number(targetAmount);
  const current = Number(currentAmount);
  const completed = isCompleted ?? (target > 0 && current >= target);

  const goal = await updateForUser("goal", session.userId, id, {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(targetAmount !== undefined && { targetAmount: target }),
      ...(currentAmount !== undefined && { currentAmount: current }),
      ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
      ...(icon !== undefined && { icon }),
      ...(isCompleted !== undefined && { isCompleted: completed }),
  });

  if (!goal) return jsonError("Goal not found", 404);
  return jsonOk(goal);
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("ID required");

  const deleted = await deleteForUser("goal", session.userId, id);
  if (!deleted) return jsonError("Goal not found", 404);
  return jsonOk({ success: true });
}
