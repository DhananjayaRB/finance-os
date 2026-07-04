import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { getUsageTrend, type UsageTrendPeriod } from "@/lib/usage-trend";

const VALID_PERIODS: UsageTrendPeriod[] = [
  "this_month",
  "salary_cycle",
  "last_3_months",
  "last_6_months",
  "this_year",
  "all",
];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") || "this_month";
  const period = VALID_PERIODS.includes(periodParam as UsageTrendPeriod)
    ? (periodParam as UsageTrendPeriod)
    : "this_month";

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { salaryDay: true },
  });

  const data = await getUsageTrend(session.userId, period, user?.salaryDay ?? 7);
  return jsonOk(data);
}
