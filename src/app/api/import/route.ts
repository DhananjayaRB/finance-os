import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonOk, jsonError } from "@/lib/api-utils";
import { importExcelData } from "@/lib/excel-import";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return jsonError("No file uploaded");

  const buffer = await file.arrayBuffer();
  const result = await importExcelData(session.userId, buffer, file.name);

  return jsonOk(result);
}

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Unauthorized", 401);

  const history = await prisma.importHistory.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return jsonOk(history);
}
