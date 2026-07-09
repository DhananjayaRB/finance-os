import * as XLSX from "xlsx";
import prisma from "@/lib/db";
import { decimalToNumber } from "@/lib/utils";
import { inferLoanType } from "@/lib/constants";

interface ImportResult {
  loans: number;
  incomes: number;
  fixedExpenses: number;
  subscriptions: number;
  savings: number;
  budgets: number;
  errors: string[];
}

function parseNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

function findSheet(workbook: XLSX.WorkBook, keywords: string[]): XLSX.WorkSheet | null {
  for (const name of workbook.SheetNames) {
    const lower = name.toLowerCase();
    if (keywords.some((k) => lower.includes(k))) {
      return workbook.Sheets[name];
    }
  }
  return workbook.Sheets[workbook.SheetNames[0]] || null;
}

function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
}

export async function importExcelData(
  userId: string,
  buffer: ArrayBuffer,
  fileName: string
): Promise<ImportResult> {
  const result: ImportResult = {
    loans: 0,
    incomes: 0,
    fixedExpenses: 0,
    subscriptions: 0,
    savings: 0,
    budgets: 0,
    errors: [],
  };

  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = findSheet(workbook, ["july", "planned", "finance", "2026"]);
    if (!sheet) {
      result.errors.push("No valid sheet found");
      return result;
    }

    const rows = sheetToRows(sheet);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    for (const row of rows) {
      const cells = row.map((c) => String(c).trim().toLowerCase());
      const rowText = cells.join(" ");

      // Loan rows: name + amount + outstanding pattern
      if (
        rowText.includes("idfc") ||
        rowText.includes("canara") ||
        rowText.includes("kbl") ||
        rowText.includes("ebl") ||
        rowText.includes("hdfc") ||
        rowText.includes("cashbee") ||
        rowText.includes("cashier") ||
        rowText.includes("phone salary") ||
        rowText.includes(" mf") ||
        rowText.includes(" mv")
      ) {
        const name = String(row[0] || "").trim();
        const emi = parseNumber(row[1]);
        const outstanding = parseNumber(row[2]) || emi * 12;
        const pendingEmi = parseNumber(row[3]) || 12;
        const emiDate = parseNumber(row[4]) || 5;
        const interestRate = parseNumber(row[5]) || 12;

        if (name && emi > 0) {
          const existing = await prisma.loan.findFirst({
            where: { userId, name: { equals: name, mode: "insensitive" } },
          });

          if (existing) {
            await prisma.loan.update({
              where: { id: existing.id },
              data: {
                emiAmount: emi,
                outstanding,
                pendingEmi: Math.round(pendingEmi),
                emiDate: Math.min(28, Math.max(1, Math.round(emiDate))),
                interestRate,
                loanType: inferLoanType(name),
              },
            });
          } else {
            await prisma.loan.create({
              data: {
                userId,
                name,
                emiAmount: emi,
                outstanding,
                pendingEmi: Math.round(pendingEmi),
                emiDate: Math.min(28, Math.max(1, Math.round(emiDate))),
                interestRate,
                loanType: inferLoanType(name),
              },
            });
          }
          result.loans++;
        }
      }

      // Fixed expense: rent, parents, home
      if (
        cells[0] &&
        (cells[0].includes("rent") ||
          cells[0].includes("parents") ||
          cells[0].includes("home food") ||
          cells[0].includes("home expense") ||
          cells[0].includes("others"))
      ) {
        const name = String(row[0]).trim();
        const amount = parseNumber(row[1]);
        if (amount > 0) {
          const existing = await prisma.fixedExpense.findFirst({
            where: { userId, name: { equals: name, mode: "insensitive" } },
          });
          if (existing) {
            await prisma.fixedExpense.update({
              where: { id: existing.id },
              data: { amount },
            });
          } else {
            await prisma.fixedExpense.create({
              data: { userId, name, amount, isPayable: true },
            });
          }
          result.fixedExpenses++;
        }
      }

      // Subscriptions
      const subNames = ["netflix", "prime", "jio", "youtube", "airtel", "google one", "zomato", "zepto"];
      if (cells[0] && subNames.some((s) => cells[0].includes(s))) {
        const name = String(row[0]).trim();
        const amount = parseNumber(row[1] || row[2]);
        if (amount > 0) {
          const existing = await prisma.subscription.findFirst({
            where: { userId, name: { equals: name, mode: "insensitive" } },
          });
          if (existing) {
            await prisma.subscription.update({
              where: { id: existing.id },
              data: { amount },
            });
          } else {
            await prisma.subscription.create({
              data: { userId, name, amount, cycle: "MONTHLY", autoDebit: true },
            });
          }
          result.subscriptions++;
        }
      }

      // Savings: gold, cash, pf
      if (cells[0] && (cells[0].includes("gold") || cells[0] === "cash" || cells[0].includes("pf"))) {
        const name = String(row[0]).trim();
        const amount = parseNumber(row[1]);
        const existing = await prisma.saving.findFirst({
          where: { userId, name: { equals: name, mode: "insensitive" } },
        });
        if (existing) {
          await prisma.saving.update({ where: { id: existing.id }, data: { amount } });
        } else {
          await prisma.saving.create({
            data: {
              userId,
              name,
              amount,
              type: cells[0].includes("gold") ? "GOLD" : cells[0].includes("pf") ? "PF" : "CASH",
            },
          });
        }
        result.savings++;
      }

      // Income sources
      if (
        cells[0] &&
        (cells[0].includes("salary") ||
          cells[0].includes("hdfc") ||
          cells[0].includes("canara") ||
          cells[0].includes("gold") ||
          cells[0].includes("pf") ||
          cells[0].includes("10th"))
      ) {
        const source = String(row[0]).trim();
        const amount = parseNumber(row[1]);
        if (amount > 0 && !source.toLowerCase().includes("total")) {
          await prisma.income.create({
            data: {
              userId,
              source,
              amount,
              month,
              year,
              isRecurring: source.toLowerCase().includes("salary"),
            },
          });
          result.incomes++;
        }
      }
    }

    // Update budget from totals
    const totalIncome = await prisma.income.aggregate({
      where: { userId, month, year },
      _sum: { amount: true },
    });

    const totalEmi = await prisma.loan.aggregate({
      where: { userId, status: "ACTIVE" },
      _sum: { emiAmount: true },
    });

    const incomeVal = decimalToNumber(totalIncome._sum.amount || 135000);
    const emiVal = decimalToNumber(totalEmi._sum.emiAmount || 79618);

    await prisma.budget.upsert({
      where: { userId_year_month: { userId, year, month } },
      create: {
        userId,
        month,
        year,
        totalIncome: incomeVal,
        emiAmount: emiVal,
        needAmount: 68000,
        wantAmount: 15000,
        luxuryAmount: 7000,
        savingsAmount: 25000,
        investmentAmount: 10000,
        fixedExpense: 50000,
        subscriptionAmount: 4450,
      },
      update: {
        totalIncome: incomeVal,
        emiAmount: emiVal,
      },
    });
    result.budgets = 1;

    await prisma.importHistory.create({
      data: {
        userId,
        fileName,
        status: result.errors.length ? "PARTIAL" : "SUCCESS",
        recordsCount:
          result.loans +
          result.incomes +
          result.fixedExpenses +
          result.subscriptions +
          result.savings +
          result.budgets,
        errors: result.errors.length ? result.errors.join("; ") : null,
      },
    });
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "Import failed");
    await prisma.importHistory.create({
      data: {
        userId,
        fileName,
        status: "FAILED",
        errors: result.errors.join("; "),
      },
    });
  }

  return result;
}

export const SEED_DATA = {
  income: 135000,
  salaryDay: 7,
  defaultPin: "12345",
  loans: [
    { name: "IDFC(2)", emiAmount: 11300, outstanding: 141414, pendingEmi: 11, emiDate: 2, interestRate: 17, loanType: "PERSONAL" as const },
    { name: "CANARA", emiAmount: 18000, outstanding: 321300, pendingEmi: 18, emiDate: 5, interestRate: 14, loanType: "PERSONAL" as const },
    { name: "Phone Salary(1)", emiAmount: 6730, outstanding: 75000, pendingEmi: 12, emiDate: 10, interestRate: 18, loanType: "APP" as const },
    { name: "Cashbee", emiAmount: 10130, outstanding: 95000, pendingEmi: 10, emiDate: 12, interestRate: 16, loanType: "APP" as const },
    { name: "KBL(2)", emiAmount: 10130, outstanding: 154422, pendingEmi: 15, emiDate: 15, interestRate: 15, loanType: "PERSONAL" as const },
    { name: "EBL", emiAmount: 9222, outstanding: 253000, pendingEmi: 28, emiDate: 18, interestRate: 13, loanType: "PERSONAL" as const },
    { name: "MF", emiAmount: 2337, outstanding: 25000, pendingEmi: 11, emiDate: 21, interestRate: 12, loanType: "APP" as const },
    { name: "MV", emiAmount: 5111, outstanding: 45000, pendingEmi: 9, emiDate: 22, interestRate: 14, loanType: "APP" as const },
    { name: "HDFC RuPay", emiAmount: 3128, outstanding: 35000, pendingEmi: 12, emiDate: 25, interestRate: 24, loanType: "CREDIT_CARD" as const },
    { name: "HDFC Millenia", emiAmount: 3530, outstanding: 40000, pendingEmi: 12, emiDate: 28, interestRate: 24, loanType: "CREDIT_CARD" as const },
  ],
  fixedExpenses: [
    { name: "Rent", amount: 14000 },
    { name: "Home Food", amount: 11000 },
    { name: "Parents", amount: 20000 },
    { name: "Others", amount: 5000 },
    { name: "Home Expense", amount: 14000 },
  ],
  subscriptions: [
    { name: "Netflix", amount: 200 },
    { name: "Prime", amount: 1500 },
    { name: "Jio", amount: 300 },
    { name: "Youtube", amount: 300 },
    { name: "Airtel Wifi 1", amount: 1000 },
    { name: "Airtel Wifi 2", amount: 1000 },
    { name: "Google One", amount: 150 },
    { name: "Zomato", amount: 500 },
    { name: "Zepto", amount: 500 },
  ],
  incomes: [
    { source: "Salary-1", amount: 105000, isRecurring: true },
    { source: "HDFC", amount: 4000 },
    { source: "CANARA", amount: 1500 },
    { source: "GOLD", amount: 4500 },
    { source: "3rd 10th", amount: 3000 },
    { source: "PF", amount: 2000 },
    { source: "3rd 10th Bonus", amount: 15000 },
  ],
  savings: [
    { name: "Gold", amount: 5000, type: "GOLD" as const },
    { name: "PF", amount: 25000, type: "PF" as const },
    { name: "Emergency Fund", amount: 50000, type: "EMERGENCY_FUND" as const },
  ],
  investments: [
    { name: "Mutual Fund SIP", amount: 10000, type: "MF" as const },
    { name: "PPF", amount: 15000, type: "PPF" as const },
  ],
  creditCards: [
    { name: "HDFC RuPay", limit: 150000, used: 45000, statementDay: 1, dueDay: 21 },
    { name: "HDFC Millenia", limit: 200000, used: 62000, statementDay: 5, dueDay: 25 },
  ],
  cashBoxes: [
    { name: "Wallet Cash", type: "WALLET" as const, balance: 2350, isPrimary: true },
    { name: "Home Cash", type: "HOME" as const, balance: 5000 },
    { name: "Office Cash", type: "OFFICE" as const, balance: 1000 },
    { name: "Emergency Cash", type: "EMERGENCY" as const, balance: 10000 },
  ],
  goals: [
    { name: "Emergency Fund", targetAmount: 250000, currentAmount: 50000 },
    { name: "Bike", targetAmount: 150000, currentAmount: 30000 },
    { name: "Vacation", targetAmount: 80000, currentAmount: 15000 },
  ],
};
