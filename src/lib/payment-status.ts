import type { PaymentStatus } from "@/generated/prisma/client";

export type PaymentStatusValue = PaymentStatus;

export const PAYMENT_STATUS_META: Record<
  PaymentStatusValue,
  { label: string; color: string; description: string }
> = {
  PAID: {
    label: "Paid",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    description: "Payment completed for this cycle",
  },
  PENDING: {
    label: "Pending",
    color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    description: "Not yet due — scheduled for later this cycle",
  },
  DUE: {
    label: "Due",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    description: "Payment due today or this week",
  },
  OVERDUE: {
    label: "Overdue",
    color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    description: "Past due date — pay immediately",
  },
  CLOSED: {
    label: "Closed",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    description: "Loan/account closed",
  },
};

export function computePaymentStatus(params: {
  amount: number;
  payable: number;
  dueDay?: number | null;
  currentDay: number;
  isClosed?: boolean;
}): PaymentStatusValue {
  const { amount, payable, dueDay, currentDay, isClosed } = params;

  if (isClosed) return "CLOSED";
  if (amount <= 0 && payable <= 0) return "PAID";
  if (payable <= 0 && amount > 0) return "PAID";

  if (payable > 0 && dueDay) {
    if (currentDay > dueDay) return "OVERDUE";
    if (currentDay >= dueDay - 2 && currentDay <= dueDay + 1) return "DUE";
  }

  if (payable > 0) return "PENDING";
  return "PAID";
}

/** Use stored status from DB; only auto-derive PAID/CLOSED when balance is zero. */
export function resolveDisplayStatus(params: {
  stored: PaymentStatusValue;
  payable: number;
  isClosed?: boolean;
}): PaymentStatusValue {
  if (params.isClosed) return "CLOSED";
  if (params.payable <= 0) return "PAID";
  return params.stored;
}

export function isBeforeSalary(dueDay: number, salaryDay: number): boolean {
  return dueDay < salaryDay;
}

export function getStatusMeta(status: PaymentStatusValue) {
  return PAYMENT_STATUS_META[status] ?? PAYMENT_STATUS_META.PENDING;
}
