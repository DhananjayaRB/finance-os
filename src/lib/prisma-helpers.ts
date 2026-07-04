import prisma from "@/lib/db";

type OwnedModel =
  | "loan"
  | "goal"
  | "creditCard"
  | "subscription"
  | "expense"
  | "fixedExpense"
  | "saving"
  | "income"
  | "insurance"
  | "savingEntry";

type FindFirstDelegate = {
  findFirst: (args: { where: { id: string; userId: string } }) => Promise<unknown>;
};

type UpdateDelegate = {
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
};

type DeleteManyDelegate = {
  deleteMany: (args: { where: { id: string; userId: string } }) => Promise<{ count: number }>;
};

/** Verify ownership, then update by primary key (Prisma update requires unique id only). */
export async function updateForUser(
  model: OwnedModel,
  userId: string,
  id: string,
  data: Record<string, unknown>
) {
  const finder = prisma[model] as unknown as FindFirstDelegate;
  const existing = await finder.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const updater = prisma[model] as unknown as UpdateDelegate;
  return updater.update({ where: { id }, data });
}

/** Delete a record scoped to userId. */
export async function deleteForUser(model: OwnedModel, userId: string, id: string) {
  const result = await (prisma[model] as unknown as DeleteManyDelegate).deleteMany({
    where: { id, userId },
  });
  return result.count > 0;
}
