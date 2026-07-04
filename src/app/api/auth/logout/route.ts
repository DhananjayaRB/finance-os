import { destroySession } from "@/lib/auth";
import { jsonOk } from "@/lib/api-utils";

export async function POST() {
  await destroySession();
  return jsonOk({ success: true });
}
