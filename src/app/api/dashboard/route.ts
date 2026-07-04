import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { jsonOk, jsonError } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return jsonError("Unauthorized", 401);
    const data = await getDashboardData(session.userId);
    return jsonOk(data);
  } catch {
    return jsonError("Failed to load dashboard", 500);
  }
}
