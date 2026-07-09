import prisma from "@/lib/db";
import { isBankPayment } from "@/lib/constants";

export { isBankPayment };

export async function getPrimaryAccount(userId: string) {
  const primary = await prisma.account.findFirst({
    where: { userId, isPrimary: true },
  });
  if (primary) return primary;
  return prisma.account.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

/** Ensure every user has at least one primary bank account for ledger linking. */
export async function ensureDefaultBankAccount(userId: string) {
  const existing = await getPrimaryAccount(userId);
  if (existing) {
    if (!existing.isPrimary) {
      return prisma.account.update({
        where: { id: existing.id },
        data: { isPrimary: true },
      });
    }
    return existing;
  }

  return prisma.account.create({
    data: {
      userId,
      name: "Primary Bank",
      bankName: null,
      balance: 0,
      isPrimary: true,
    },
  });
}

export async function getDefaultCashBox(userId: string) {
  const primary = await prisma.cashBox.findFirst({
    where: { userId, isPrimary: true },
  });
  if (primary) return primary;
  const wallet = await prisma.cashBox.findFirst({
    where: { userId, type: "WALLET" },
    orderBy: { createdAt: "asc" },
  });
  if (wallet) return wallet;
  return prisma.cashBox.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function creditAccount(params: {
  userId: string;
  accountId: string;
  amount: number;
  description?: string;
  refType?: string;
  refId?: string;
}) {
  const { userId, accountId, amount } = params;
  if (amount <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new Error("Account not found");

    const updated = await tx.account.update({
      where: { id: accountId },
      data: { balance: Number(account.balance) + amount },
    });

    await tx.accountTransaction.create({
      data: {
        userId,
        accountId,
        type: "CREDIT",
        amount,
        description: params.description,
        refType: params.refType,
        refId: params.refId,
      },
    });

    return updated;
  });
}

export async function debitAccount(params: {
  userId: string;
  accountId: string;
  amount: number;
  description?: string;
  refType?: string;
  refId?: string;
}) {
  const { userId, accountId, amount } = params;
  if (amount <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const account = await tx.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new Error("Account not found");

    const newBalance = Number(account.balance) - amount;
    if (newBalance < 0) throw new Error("Insufficient bank balance");

    const updated = await tx.account.update({
      where: { id: accountId },
      data: { balance: newBalance },
    });

    await tx.accountTransaction.create({
      data: {
        userId,
        accountId,
        type: "DEBIT",
        amount,
        description: params.description,
        refType: params.refType,
        refId: params.refId,
      },
    });

    return updated;
  });
}

export async function creditCashBox(params: {
  userId: string;
  cashBoxId: string;
  amount: number;
  description?: string;
}) {
  const { userId, cashBoxId, amount } = params;
  if (amount <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const box = await tx.cashBox.findFirst({ where: { id: cashBoxId, userId } });
    if (!box) throw new Error("Cash box not found");

    const updated = await tx.cashBox.update({
      where: { id: cashBoxId },
      data: { balance: Number(box.balance) + amount },
    });

    await tx.cashTransaction.create({
      data: {
        userId,
        cashBoxId,
        type: "CASH_IN",
        amount,
        description: params.description,
      },
    });

    return updated;
  });
}

export async function debitCashBox(params: {
  userId: string;
  cashBoxId: string;
  amount: number;
  description?: string;
}) {
  const { userId, cashBoxId, amount } = params;
  if (amount <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const box = await tx.cashBox.findFirst({ where: { id: cashBoxId, userId } });
    if (!box) throw new Error("Cash box not found");

    const newBalance = Number(box.balance) - amount;
    if (newBalance < 0) throw new Error("Insufficient cash balance");

    const updated = await tx.cashBox.update({
      where: { id: cashBoxId },
      data: { balance: newBalance },
    });

    await tx.cashTransaction.create({
      data: {
        userId,
        cashBoxId,
        type: "CASH_OUT",
        amount,
        description: params.description,
      },
    });

    return updated;
  });
}

export async function applyExpenseToSource(params: {
  userId: string;
  amount: number;
  paymentMethod: string;
  accountId?: string | null;
  cashBoxId?: string | null;
  refId: string;
  description?: string;
}): Promise<{ accountId?: string; cashBoxId?: string } | null> {
  const { userId, amount, paymentMethod, refId } = params;
  if (amount <= 0) return null;

  if (paymentMethod === "CASH") {
    let cashBoxId = params.cashBoxId;
    if (!cashBoxId) {
      const box = await getDefaultCashBox(userId);
      if (!box) return null;
      cashBoxId = box.id;
    }
    await debitCashBox({
      userId,
      cashBoxId,
      amount,
      description: params.description || `Expense`,
    });
    return { cashBoxId };
  }

  if (paymentMethod === "CREDIT_CARD") return null;

  if (isBankPayment(paymentMethod)) {
    let accountId = params.accountId;
    if (!accountId) {
      const account = await ensureDefaultBankAccount(userId);
      accountId = account.id;
    }
    await debitAccount({
      userId,
      accountId,
      amount,
      description: params.description,
      refType: "expense",
      refId,
    });
    return { accountId };
  }

  return null;
}

export async function applyIncomeToAccount(params: {
  userId: string;
  amount: number;
  accountId?: string | null;
  refId: string;
  description?: string;
}): Promise<string | null> {
  const { userId, amount, refId } = params;
  if (amount <= 0) return null;

  let accountId = params.accountId;
  if (!accountId) {
    const account = await ensureDefaultBankAccount(userId);
    accountId = account.id;
  }

  await creditAccount({
    userId,
    accountId,
    amount,
    description: params.description,
    refType: "income",
    refId,
  });

  return accountId;
}

export async function reverseExpenseFromSource(params: {
  userId: string;
  amount: number;
  paymentMethod: string;
  accountId?: string | null;
  cashBoxId?: string | null;
  refId: string;
  description?: string;
}) {
  const { userId, amount, paymentMethod, accountId, cashBoxId, refId } = params;
  if (amount <= 0) return;

  if (paymentMethod === "CASH") {
    let boxId = cashBoxId;
    if (!boxId) {
      const box = await getDefaultCashBox(userId);
      if (!box) return;
      boxId = box.id;
    }
    await creditCashBox({
      userId,
      cashBoxId: boxId,
      amount,
      description: params.description || "Expense deleted — cash restored",
    });
    return;
  }

  if (accountId && isBankPayment(paymentMethod)) {
    await creditAccount({
      userId,
      accountId,
      amount,
      description: params.description || "Expense deleted — balance restored",
      refType: "expense_reversal",
      refId,
    });
  }
}

export async function reverseIncomeFromAccount(params: {
  userId: string;
  amount: number;
  accountId?: string | null;
  refId: string;
}) {
  const { userId, amount, accountId, refId } = params;
  if (amount <= 0 || !accountId) return;

  await debitAccount({
    userId,
    accountId,
    amount,
    description: "Income deleted — balance adjusted",
    refType: "income_reversal",
    refId,
  });
}

export function insuranceMonthlyAmount(premium: number, cycle: string) {
  if (cycle === "YEARLY") return premium / 12;
  if (cycle === "QUARTERLY") return premium / 3;
  return premium;
}
