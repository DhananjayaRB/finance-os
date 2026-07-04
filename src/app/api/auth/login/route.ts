import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { createSession, verifyPin } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();
    if (!pin || !/^\d{5}$/.test(pin)) {
      return jsonError("PIN must be exactly 5 digits");
    }

    const user = await prisma.user.findFirst();
    if (!user) {
      return jsonError("No account found. Please set up first.", 404);
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
