import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { createSession, hashPin } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import { SEED_DATA } from "@/lib/excel-import";
import { seedExcelTemplate } from "@/lib/seed-excel-template";

export async function POST(request: NextRequest) {
  try {
    const existing = await prisma.user.findFirst();
    if (existing) {
      return jsonError("Account already exists. Please login.", 409);
    }

    const { pin, name } = await request.json();
    if (!pin || !/^\d{5}$/.test(pin)) {
      return jsonError("PIN must be exactly 5 digits");
    }

    const pinHash = await hashPin(pin);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const user = await prisma.user.create({
      data: {
        name: name || "Finance User",
        pinHash,
        salaryDay: 7,
      },
    });

    for (const cat of DEFAULT_CATEGORIES) {
      await prisma.category.create({
        data: { userId: user.id, ...cat, isDefault: true },
      });
    }

    await seedExcelTemplate(user.id, month, year);

    for (const box of SEED_DATA.cashBoxes) {
      await prisma.cashBox.create({ data: { userId: user.id, ...box } });
    }

    await createSession({ userId: user.id, name: user.name });
    return jsonOk({ success: true, name: user.name });
  } catch (err) {
    console.error(err);
    return jsonError("Setup failed", 500);
  }
}

export async function GET() {
  const user = await prisma.user.findFirst();
  return jsonOk({ hasAccount: !!user });
}
