import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { createSession, verifyPin } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { isValidPin, normalizeMobile } from "@/lib/auth-validators";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier || body.email || body.mobile || "").trim();
    const pin = String(body.pin || "");

    if (!identifier) {
      return jsonError("Email or mobile number is required");
    }
    if (!isValidPin(pin)) {
      return jsonError("PIN must be exactly 5 digits");
    }

    const normalizedMobile = normalizeMobile(identifier);
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: "insensitive" } },
          ...(normalizedMobile.length === 10 ? [{ mobile: normalizedMobile }] : []),
        ],
      },
    });

    if (!user) {
      return jsonError("No account found for this email or mobile", 404);
    }

    const valid = await verifyPin(pin, user.pinHash);
    if (!valid) {
      return jsonError("Invalid PIN", 401);
    }

    await createSession({ userId: user.id, name: user.name });
    return jsonOk({ success: true, name: user.name });
  } catch {
    return jsonError("Login failed", 500);
  }
}
