import prisma from "@/lib/db";
import {
  ensureDefaultBankAccount,
  creditAccount,
  debitAccount,
  applyIncomeToAccount,
} from "@/lib/account-ledger";
import type { PaymentStatus } from "@/generated/prisma/client";

export type PlanPayableRefType =
  | "plan_loan"
  | "plan_home"
  | "plan_saving"
  | "plan_saving_entry"
  | "plan_subscription"
  | "plan_insurance"
  | "plan_month";

const INCOME_REF_TYPES = ["income", "income_reversal"];

function toNum(value: unknown): number {
  return Number(value) || 0;
}

/** Net money debited from bank for a plan payable item (positive = paid out). */
export async function getNetLedgerDebit(
  userId: string,
  refTypes: string | string[],
  refId: string
): Promise<number> {
  const types = Array.isArray(refTypes) ? refTypes : [refTypes];
  const txs = await prisma.accountTransaction.findMany({
    where: { userId, refId, refType: { in: types } },
  });
  return txs.reduce((net, tx) => {
    const amt = toNum(tx.amount);
    if (tx.type === "DEBIT") return net + amt;
    if (tx.type === "CREDIT") return net - amt;
    return net;
  }, 0);
}

/** Net money credited to bank for an income row (positive = received). */
export async function getNetIncomeCredit(userId: string, refId: string): Promise<number> {
  const txs = await prisma.accountTransaction.findMany({
    where: { userId, refId, refType: { in: INCOME_REF_TYPES } },
  });
  return txs.reduce((net, tx) => {
    const amt = toNum(tx.amount);
    if (tx.type === "CREDIT") return net + amt;
    if (tx.type === "DEBIT") return net - amt;
    return net;
  }, 0);
}

/** Sync bank when payable amount decreases (paid) or increases (reversed). */
export async function syncPayableLedgerDelta(params: {
  userId: string;
  refType: PlanPayableRefType;
  refId: string;
  previousPayable: number;
  newPayable: number;
  label: string;
}) {
  const { userId, refType, refId, previousPayable, newPayable, label } = params;
  const paidDelta = previousPayable - newPayable;
  if (paidDelta === 0) return;

  const account = await ensureDefaultBankAccount(userId);

  if (paidDelta > 0) {
    await debitAccount({
      userId,
      accountId: account.id,
      amount: paidDelta,
      description: `Paid: ${label}`,
      refType,
      refId,
    });
    return;
  }

  await creditAccount({
    userId,
    accountId: account.id,
    amount: -paidDelta,
    description: `Reversed: ${label}`,
    refType: `${refType}_reversal`,
    refId,
  });
}

/** Sync bank when income is received, unreceived, or amount changes. */
export async function syncIncomeLedger(params: {
  userId: string;
  incomeId: string;
  isReceived: boolean;
  amount: number;
  source: string;
  accountId?: string | null;
}): Promise<string | null> {
  const { userId, incomeId, isReceived, amount, source } = params;
  const shouldCredit = isReceived && amount > 0 ? amount : 0;
  const currentlyCredited = await getNetIncomeCredit(userId, incomeId);
  const delta = shouldCredit - currentlyCredited;
  if (delta === 0) return params.accountId ?? null;

  if (delta > 0) {
    return applyIncomeToAccount({
      userId,
      amount: delta,
      accountId: params.accountId,
      refId: incomeId,
      description: `Income: ${source}`,
    });
  }

  let accountId = params.accountId;
  if (!accountId) {
    const income = await prisma.income.findFirst({ where: { id: incomeId, userId } });
    accountId = income?.accountId ?? null;
  }
  if (!accountId) {
    const account = await ensureDefaultBankAccount(userId);
    accountId = account.id;
  }

  await debitAccount({
    userId,
    accountId,
    amount: -delta,
    description: `Income reversed: ${source}`,
    refType: "income_reversal",
    refId: incomeId,
  });
  return accountId;
}

/** Undo all ledger movements for a deleted plan payable item. */
export async function reverseAllPlanLedger(
  userId: string,
  refType: PlanPayableRefType,
  refId: string,
  label: string
) {
  const netDebited = await getNetLedgerDebit(userId, [refType, `${refType}_reversal`], refId);
  if (netDebited <= 0) return;

  const account = await ensureDefaultBankAccount(userId);
  await creditAccount({
    userId,
    accountId: account.id,
    amount: netDebited,
    description: `Deleted: ${label}`,
    refType: `${refType}_reversal`,
    refId,
  });
}

export async function getPlanPayableState(
  userId: string,
  type: "loan" | "home" | "saving" | "insurance" | "subscription",
  id: string
): Promise<{
  payable: number;
  label: string;
  refType: PlanPayableRefType;
  skipLedger?: boolean;
} | null> {
  switch (type) {
    case "loan": {
      const item = await prisma.loan.findFirst({ where: { id, userId } });
      if (!item) return null;
      return {
        payable: toNum(item.payableAmount),
        label: item.name,
        refType: "plan_loan",
      };
    }
    case "home": {
      const item = await prisma.fixedExpense.findFirst({ where: { id, userId } });
      if (!item) return null;
      return {
        payable: toNum(item.payableAmount),
        label: item.name,
        refType: "plan_home",
      };
    }
    case "subscription": {
      const item = await prisma.subscription.findFirst({ where: { id, userId } });
      if (!item) return null;
      return {
        payable: toNum(item.payableAmount),
        label: item.name,
        refType: "plan_subscription",
      };
    }
    case "insurance": {
      const item = await prisma.insurance.findFirst({ where: { id, userId } });
      if (!item) return null;
      return {
        payable: toNum(item.payableAmount),
        label: item.name,
        refType: "plan_insurance",
      };
    }
    case "saving": {
      const saving = await prisma.saving.findFirst({ where: { id, userId } });
      if (saving) {
        return {
          payable: toNum(saving.payableAmount),
          label: saving.name,
          refType: "plan_saving",
        };
      }
      const entry = await prisma.savingEntry.findFirst({ where: { id, userId } });
      if (!entry) return null;
      if (entry.kind !== "DEPOSIT") {
        return {
          payable: 0,
          label: entry.name,
          refType: "plan_saving_entry",
          skipLedger: true,
        };
      }
      let payable = toNum(entry.payableAmount);
      if (payable <= 0 && entry.paymentStatus !== "PAID") {
        payable = toNum(entry.amount);
      }
      if (entry.paymentStatus === "PAID") payable = 0;
      return {
        payable,
        label: entry.name,
        refType: "plan_saving_entry",
      };
    }
    default:
      return null;
  }
}

export function resolvePayableFromRecord(
  type: PlanPayableRefType,
  record: Record<string, unknown>
): number {
  if (type === "plan_saving_entry") {
    const kind = record.kind as string | undefined;
    if (kind && kind !== "DEPOSIT") return 0;
    let payable = toNum(record.payableAmount);
    if (payable <= 0 && record.paymentStatus !== "PAID") {
      payable = toNum(record.amount);
    }
    if (record.paymentStatus === "PAID") payable = 0;
    return payable;
  }
  return toNum(record.payableAmount);
}

export function resolveMonthRowPayable(row: {
  amount: unknown;
  payableAmount: unknown;
  paymentStatus: PaymentStatus;
}): number {
  if (row.paymentStatus === "PAID") return 0;
  let payable = toNum(row.payableAmount);
  const amount = toNum(row.amount);
  if (payable <= 0 && amount > 0) payable = amount;
  return payable;
}

export async function getMonthPlanPayableState(row: {
  id: string;
  amount: unknown;
  payableAmount: unknown;
  paymentStatus: PaymentStatus;
  sourceType: string;
  sourceId: string;
}) {
  const label = await resolveMonthPaymentLabel(row.sourceType, row.sourceId);
  return {
    payable: resolveMonthRowPayable(row),
    label,
    refType: "plan_month" as PlanPayableRefType,
    refId: row.id,
  };
}

async function resolveMonthPaymentLabel(sourceType: string, sourceId: string) {
  switch (sourceType) {
    case "LOAN": {
      const item = await prisma.loan.findUnique({ where: { id: sourceId } });
      return item?.name ?? "Loan";
    }
    case "HOME":
    case "MONTHLY_FIXED": {
      const item = await prisma.fixedExpense.findUnique({ where: { id: sourceId } });
      return item?.name ?? "Expense";
    }
    case "SUBSCRIPTION": {
      const item = await prisma.subscription.findUnique({ where: { id: sourceId } });
      return item?.name ?? "Subscription";
    }
    case "INSURANCE": {
      const item = await prisma.insurance.findUnique({ where: { id: sourceId } });
      return item?.name ?? "Insurance";
    }
    case "SAVING": {
      const item = await prisma.saving.findUnique({ where: { id: sourceId } });
      return item?.name ?? "Saving";
    }
    default:
      return "Plan item";
  }
}

export async function syncPlanItemCreateLedger(
  userId: string,
  type: PlanItemLedgerType,
  created: Record<string, unknown>
) {
  if (type === "income") {
    const isReceived = Boolean(created.isReceived);
    if (!isReceived) return;
    const accountId = await syncIncomeLedger({
      userId,
      incomeId: String(created.id),
      isReceived: true,
      amount: toNum(created.amount),
      source: String(created.source),
      accountId: (created.accountId as string | null) ?? null,
    });
    if (accountId && !created.accountId) {
      await prisma.income.update({
        where: { id: String(created.id) },
        data: { accountId },
      });
    }
    return;
  }

  const refType = planRefTypeForCreate(type);
  if (!refType) return;

  const paymentStatus = created.paymentStatus as string | undefined;
  const amount = toNum(created.amount ?? created.emiAmount ?? created.premium);
  const payable = created.payableAmount !== undefined
    ? toNum(created.payableAmount)
    : resolvePayableFromRecord(refType, created);
  const label = String(created.name ?? created.source ?? "Item");
  const ledgerRefType: PlanPayableRefType = "plan_month";
  const ledgerRefId = String(created.id);

  if (type === "saving" && created.kind && created.kind !== "DEPOSIT") return;
  if (paymentStatus === "PAID" || payable < amount) {
    await syncPayableLedgerDelta({
      userId,
      refType: ledgerRefType,
      refId: ledgerRefId,
      previousPayable: amount,
      newPayable: payable,
      label,
    });
  }
}

export type PlanItemLedgerType =
  | "loan"
  | "home"
  | "saving"
  | "income"
  | "subscription"
  | "insurance";

function planRefTypeForCreate(type: PlanItemLedgerType): PlanPayableRefType | null {
  switch (type) {
    case "loan":
      return "plan_loan";
    case "home":
      return "plan_home";
    case "saving":
      return "plan_saving";
    case "subscription":
      return "plan_subscription";
    case "insurance":
      return "plan_insurance";
    default:
      return null;
  }
}

export async function syncPlanItemDeleteLedger(
  userId: string,
  type: PlanItemLedgerType | "monthly_fixed",
  id: string,
  refTypeOverride?: PlanPayableRefType
) {
  if (type === "monthly_fixed") return;

  if (type === "income") {
    const income = await prisma.income.findFirst({ where: { id, userId } });
    if (!income) return;
    await syncIncomeLedger({
      userId,
      incomeId: id,
      isReceived: false,
      amount: toNum(income.amount),
      source: income.source,
      accountId: income.accountId,
    });
    return;
  }

  if (refTypeOverride === "plan_month") {
    const row = await prisma.planMonthPayment.findFirst({ where: { id, userId } });
    if (!row) return;
    const state = await getMonthPlanPayableState(row);
    if (state.payable <= 0) return;
    await reverseAllPlanLedger(userId, "plan_month", id, state.label);
    return;
  }

  const state = await getPlanPayableState(
    userId,
    type as "loan" | "home" | "saving" | "insurance" | "subscription",
    id
  );
  if (!state || state.skipLedger) return;
  await reverseAllPlanLedger(userId, state.refType, id, state.label);
}
