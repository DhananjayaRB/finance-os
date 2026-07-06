import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { inferLoanType, parseLoanType } from "@/lib/constants";
import { formatPrismaError } from "@/lib/prisma-errors";
import { updateForUser, deleteForUser } from "@/lib/prisma-helpers";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const loans = await prisma.loan.findMany({
    where: { userId: session.userId },
    include: { payments: { orderBy: { date: "desc" }, take: 10 } },
    orderBy: { emiDate: "asc" },
  });

  return jsonOk(loans);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const loan = await prisma.loan.create({
      data: {
        userId: session.userId,
        name: String(body.name),
        outstanding: Number(body.outstanding) || 0,
        emiAmount: Number(body.emiAmount) || 0,
        interestRate: Number(body.interestRate) || 12,
        emiDate: Number(body.emiDate) || 5,
        pendingEmi: Number(body.pendingEmi) || 12,
        loanType: parseLoanType(body.loanType) || inferLoanType(body.name || ""),
        lender: body.lender,
      },
    });

    return jsonOk(loan, 201);
  } catch (err) {
    console.error("POST /api/loans:", err);
    return jsonError("Failed to create loan", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return jsonError("Unauthorized", 401);

    const body = await request.json();
    const { id, name, outstanding, emiAmount, interestRate, emiDate, pendingEmi, loanType, lender, status } = body;
    if (!id) return jsonError("ID required");

    const data: Record<string, unknown> = {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(outstanding !== undefined && { outstanding: Number(outstanding) }),
      ...(emiAmount !== undefined && { emiAmount: Number(emiAmount) }),
      ...(interestRate !== undefined && { interestRate: Number(interestRate) }),
      ...(emiDate !== undefined && { emiDate: Number(emiDate) }),
      ...(pendingEmi !== undefined && { pendingEmi: Number(pendingEmi) }),
      ...(lender !== undefined && { lender }),
      ...(status !== undefined && { status }),
    };

    if (loanType !== undefined) {
      const parsed = parseLoanType(loanType);
      if (!parsed) return jsonError(`Invalid loan type: ${loanType}`);
      data.loanType = parsed;
    }

    const loan = await updateForUser("loan", session.userId, id, data);

    if (!loan) return jsonError("Loan not found", 404);
    return jsonOk(loan);
  } catch (err) {
    console.error("PUT /api/loans:", err);
    return jsonError(formatPrismaError(err), 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return jsonError("Unauthorized", 401);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return jsonError("ID required");

    const deleted = await deleteForUser("loan", session.userId, id);
    if (!deleted) return jsonError("Loan not found", 404);

    return jsonOk({ success: true });
  } catch (err) {
    console.error("DELETE /api/loans:", err);
    return jsonError("Failed to delete loan", 500);
  }
}
