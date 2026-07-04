import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { updateForUser, deleteForUser } from "@/lib/prisma-helpers";
import { insuranceMonthlyAmount } from "@/lib/account-ledger";
import type { InsuranceType, SubscriptionCycle } from "@/generated/prisma/client";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const insurances = await prisma.insurance.findMany({
    where: { userId: session.userId },
    orderBy: { name: "asc" },
  });

  const monthlyTotal = insurances
    .filter((i) => i.isActive)
    .reduce((sum, i) => sum + insuranceMonthlyAmount(Number(i.premium), i.cycle), 0);

  return jsonOk({ insurances, monthlyTotal });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const name = String(body.name || "").trim();
  if (!name) return jsonError("Name required");

  const premium = Number(body.premium) || 0;
  const insurance = await prisma.insurance.create({
    data: {
      userId: session.userId,
      name,
      provider: body.provider || null,
      insuranceType: (body.insuranceType || "MEDICAL") as InsuranceType,
      premium,
      coverageAmount: body.coverageAmount != null ? Number(body.coverageAmount) : null,
      cycle: (body.cycle || "YEARLY") as SubscriptionCycle,
      renewalDay: body.renewalDay != null ? Number(body.renewalDay) : null,
      payableAmount: Number(body.payableAmount) || insuranceMonthlyAmount(premium, body.cycle || "YEARLY"),
      paymentStatus: body.paymentStatus || "PENDING",
      isActive: body.isActive ?? true,
      notes: body.notes || null,
    },
  });

  return jsonOk(insurance, 201);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { id, ...rest } = body;
  if (!id) return jsonError("ID required");

  const data: Record<string, unknown> = {};
  if (rest.name !== undefined) data.name = String(rest.name).trim();
  if (rest.provider !== undefined) data.provider = rest.provider || null;
  if (rest.insuranceType !== undefined) data.insuranceType = rest.insuranceType;
  if (rest.premium !== undefined) data.premium = Number(rest.premium);
  if (rest.coverageAmount !== undefined) data.coverageAmount = rest.coverageAmount != null ? Number(rest.coverageAmount) : null;
  if (rest.cycle !== undefined) data.cycle = rest.cycle;
  if (rest.renewalDay !== undefined) data.renewalDay = rest.renewalDay != null ? Number(rest.renewalDay) : null;
  if (rest.payableAmount !== undefined) data.payableAmount = Number(rest.payableAmount);
  if (rest.paymentStatus !== undefined) data.paymentStatus = rest.paymentStatus;
  if (rest.isActive !== undefined) data.isActive = Boolean(rest.isActive);
  if (rest.notes !== undefined) data.notes = rest.notes || null;
  if (rest.paymentStatus === "PAID") data.payableAmount = 0;

  const insurance = await updateForUser("insurance", session.userId, id, data);
  if (!insurance) return jsonError("Insurance not found", 404);
  return jsonOk(insurance);
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("ID required");

  const deleted = await deleteForUser("insurance", session.userId, id);
  if (!deleted) return jsonError("Insurance not found", 404);
  return jsonOk({ success: true });
}
