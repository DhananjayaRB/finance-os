import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { updateForUser, deleteForUser } from "@/lib/prisma-helpers";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.userId },
    orderBy: { renewalDay: "asc" },
  });

  const total = subscriptions
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + Number(s.amount), 0);

  return jsonOk({ subscriptions, total });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const subscription = await prisma.subscription.create({
    data: {
      userId: session.userId,
      name: body.name,
      amount: body.amount,
      cycle: body.cycle || "MONTHLY",
      renewalDay: body.renewalDay ?? 1,
      autoDebit: body.autoDebit ?? true,
      cardUsed: body.cardUsed,
      isActive: body.isActive ?? true,
      notes: body.notes,
    },
  });

  return jsonOk(subscription, 201);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { id, ...data } = body;
  if (!id) return jsonError("ID required");

  const subscription = await updateForUser("subscription", session.userId, id, data);
  if (!subscription) return jsonError("Subscription not found", 404);
  return jsonOk(subscription);
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("ID required");

  const deleted = await deleteForUser("subscription", session.userId, id);
  if (!deleted) return jsonError("Subscription not found", 404);
  return jsonOk({ success: true });
}
