import prisma from "@/lib/db";

type OwnedModel =
  | "loan"
  | "goal"
  | "creditCard"
  | "subscription"
  | "expense"
  | "fixedExpense"
  | "saving"
  | "income";

type ModelDelegate = {
  updateMany: (args: {
    where: { id: string; userId: string };
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
  findUnique: (args: { where: { id: string } }) => Promise<unknown>;
  deleteMany: (args: { where: { id: string; userId: string } }) => Promise<{ count: number }>;
};

function getDelegate(model: OwnedModel): ModelDelegate {
  return prisma[model] as unknown as ModelDelegate;
}

/** Update a record scoped to userId (Prisma update only accepts @id/@@unique in where). */
export async function updateForUser(
  model: OwnedModel,
  userId: string,
  id: string,
  data: Record<string, unknown>
) {
  const delegate = getDelegate(model);
  const result = await delegate.updateMany({
    where: { id, userId },
    data,
  });

  if (result.count === 0) return null;
  return delegate.findUnique({ where: { id } });
}

/** Delete a record scoped to userId. */
export async function deleteForUser(model: OwnedModel, userId: string, id: string) {
  const result = await getDelegate(model).deleteMany({
    where: { id, userId },
  });
  return result.count > 0;
}
