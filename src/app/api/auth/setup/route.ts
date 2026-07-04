import { NextRequest } from "next/server";
import prisma from "@/lib/db";
import { createSession, hashPin } from "@/lib/auth";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import { SEED_DATA } from "@/lib/excel-import";
import { seedExcelTemplate } from "@/lib/seed-excel-template";
import { ensureDefaultBankAccount } from "@/lib/account-ledger";
import {
  isValidEmail,
  isValidMobile,
  isValidPin,
  normalizeMobile,
} from "@/lib/auth-validators";

export async function POST(request: NextRequest) {
  try {
    const { pin, name, email, mobile } = await request.json();
    const displayName = String(name || "").trim();
    const emailValue = String(email || "").trim().toLowerCase();
    const mobileValue = normalizeMobile(String(mobile || ""));

    if (!displayName) return jsonError("Name is required");
    if (!isValidEmail(emailValue)) return jsonError("Valid email is required");
    if (!isValidMobile(mobileValue)) return jsonError("Valid 10-digit mobile number is required");
    if (!isValidPin(pin)) return jsonError("PIN must be exactly 5 digits");

    const [emailTaken, mobileTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email: emailValue } }),
      prisma.user.findUnique({ where: { mobile: mobileValue } }),
    ]);

    if (emailTaken) return jsonError("An account with this email already exists", 409);
    if (mobileTaken) return jsonError("An account with this mobile number already exists", 409);

    const pinHash = await hashPin(pin);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const user = await prisma.user.create({
      data: {
        name: displayName,
        email: emailValue,
        mobile: mobileValue,
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

    await ensureDefaultBankAccount(user.id);

    await createSession({ userId: user.id, name: user.name });
    return jsonOk({ success: true, name: user.name });
  } catch (err) {
    console.error(err);
    return jsonError("Signup failed", 500);
  }
}

export async function GET() {
  const count = await prisma.user.count();
  return jsonOk({ hasAccount: count > 0, userCount: count });
}
