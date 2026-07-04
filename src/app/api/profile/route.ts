import { NextRequest } from "next/server";
import { getSession, createSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { isValidEmail, isValidMobile, normalizeMobile } from "@/lib/auth-validators";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, mobile: true, salaryDay: true, currency: true },
  });

  if (!user) return jsonError("User not found", 404);
  return jsonOk(user);
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { name, email, mobile, salaryDay, currency } = body;

  if (salaryDay !== undefined) {
    const day = Number(salaryDay);
    if (day < 1 || day > 28) return jsonError("Salary day must be between 1 and 28");
  }

  if (email !== undefined) {
    const emailValue = email ? String(email).trim().toLowerCase() : null;
    if (emailValue && !isValidEmail(emailValue)) return jsonError("Valid email is required");
    if (emailValue) {
      const taken = await prisma.user.findFirst({
        where: { email: emailValue, id: { not: session.userId } },
      });
      if (taken) return jsonError("This email is already used by another account");
    }
  }

  if (mobile !== undefined) {
    const mobileValue = mobile ? normalizeMobile(String(mobile)) : null;
    if (mobileValue && !isValidMobile(mobileValue)) return jsonError("Valid 10-digit mobile number is required");
    if (mobileValue) {
      const taken = await prisma.user.findFirst({
        where: { mobile: mobileValue, id: { not: session.userId } },
      });
      if (taken) return jsonError("This mobile number is already used by another account");
    }
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: {
      ...(name !== undefined && { name: String(name).trim() }),
      ...(email !== undefined && { email: email ? String(email).trim().toLowerCase() : null }),
      ...(mobile !== undefined && {
        mobile: mobile ? normalizeMobile(String(mobile)) : null,
      }),
      ...(salaryDay !== undefined && { salaryDay: Number(salaryDay) }),
      ...(currency !== undefined && { currency: String(currency) }),
    },
    select: { id: true, name: true, email: true, mobile: true, salaryDay: true, currency: true },
  });

  await createSession({ userId: user.id, name: user.name });

  return jsonOk(user);
}
