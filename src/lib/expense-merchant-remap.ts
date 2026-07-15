import prisma from "@/lib/db";
import { EXPENSE_AREA_NAMES, resolveExpenseArea } from "@/lib/expense-areas";

const CANONICAL = new Set(EXPENSE_AREA_NAMES.map((n) => n.toLowerCase()));

function isCanonical(merchant: string | null | undefined) {
  return Boolean(merchant && CANONICAL.has(merchant.trim().toLowerCase()));
}

/**
 * Map free-text merchants to canonical expense areas without losing original labels.
 * Original merchant is kept in merchantDetail when remapped.
 */
export async function remapExpenseMerchants(userId: string) {
  const expenses = await prisma.expense.findMany({
    where: { userId },
    include: { category: { select: { name: true } } },
  });

  const needsWork = expenses.some((exp) => !isCanonical(exp.merchant));
  if (!needsWork) {
    return { total: expenses.length, updated: 0, alreadyMapped: expenses.length };
  }

  let updated = 0;
  let alreadyMapped = 0;

  for (const exp of expenses) {
    if (isCanonical(exp.merchant)) {
      alreadyMapped += 1;
      continue;
    }

    const original = (exp.merchant || "").trim();
    const area = resolveExpenseArea(
      exp.merchant,
      exp.notes,
      exp.category?.name
    );

    const data: { merchant: string; merchantDetail?: string | null } = {
      merchant: area,
    };

    if (original && original.toLowerCase() !== area.toLowerCase()) {
      data.merchantDetail = exp.merchantDetail || original;
    }

    if (
      exp.merchant === data.merchant &&
      (exp.merchantDetail || null) === (data.merchantDetail || null)
    ) {
      alreadyMapped += 1;
      continue;
    }

    await prisma.expense.update({
      where: { id: exp.id },
      data,
    });
    updated += 1;
  }

  return { total: expenses.length, updated, alreadyMapped };
}
