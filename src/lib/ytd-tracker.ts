import { decimalToNumber } from "@/lib/utils";

export function savingsNetFromEntries(
  entries: { kind: string; amount: string | number | { toNumber?: () => number } }[]
): number {
  let deposited = 0;
  let withdrawn = 0;
  for (const e of entries) {
    const amt = decimalToNumber(e.amount);
    if (e.kind === "WITHDRAWAL") withdrawn += amt;
    else if (e.kind === "MISSED") continue;
    else deposited += amt;
  }
  return deposited - withdrawn;
}

export function sumByMonth<T extends { month: number; year: number }>(
  items: T[],
  ytdMonths: { month: number; year: number; label: string }[],
  getAmount: (item: T) => number
) {
  return ytdMonths.map(({ month, year, label }) => {
    const total = items
      .filter((i) => i.month === month && i.year === year)
      .reduce((s, i) => s + getAmount(i), 0);
    return { month, year, label, total };
  });
}
