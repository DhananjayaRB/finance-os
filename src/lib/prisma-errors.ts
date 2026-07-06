/** User-friendly message for common Prisma client / schema mismatch errors. */
export function formatPrismaError(err: unknown): string {
  if (!(err instanceof Error)) return "Database error";

  const msg = err.message;
  if (
    msg.includes("Unknown argument") ||
    msg.includes("Invalid value for argument") ||
    msg.includes("Expected LoanType")
  ) {
    return (
      "Database client is out of date. Stop the dev server, run `npm run db:push`, then `npm run dev` again."
    );
  }

  return msg.length > 200 ? `${msg.slice(0, 200)}…` : msg;
}
