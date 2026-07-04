import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "INR"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatCompact(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

export function getCurrentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function getSalaryCycleDates(salaryDay: number, refDate = new Date()) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const day = refDate.getDate();

  let cycleStart: Date;
  let cycleEnd: Date;

  if (day >= salaryDay) {
    cycleStart = new Date(year, month, salaryDay);
    cycleEnd = new Date(year, month + 1, salaryDay - 1);
  } else {
    cycleStart = new Date(year, month - 1, salaryDay);
    cycleEnd = new Date(year, month, salaryDay - 1);
  }

  return { cycleStart, cycleEnd };
}

export function decimalToNumber(value: { toNumber?: () => number } | number | string): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

export function calculateBudgetHealth(
  income: number,
  spent: number,
  budget: number
): number {
  if (budget <= 0) return 100;
  const ratio = spent / budget;
  if (ratio <= 0.7) return 100;
  if (ratio <= 0.85) return 85;
  if (ratio <= 1) return 70;
  if (ratio <= 1.15) return 50;
  return Math.max(0, Math.round(100 - (ratio - 1) * 100));
}

export function calculateLoanClosure(
  outstanding: number,
  emi: number,
  interestRate: number,
  extraPayment = 0
) {
  let balance = outstanding;
  let months = 0;
  let totalInterest = 0;
  const monthlyRate = interestRate / 100 / 12;
  const totalEmi = emi + extraPayment;

  while (balance > 0 && months < 600) {
    const interest = balance * monthlyRate;
    totalInterest += interest;
    const principal = Math.min(totalEmi - interest, balance);
    if (principal <= 0) break;
    balance -= principal;
    months++;
  }

  const baseMonths = (() => {
    let b = outstanding;
    let m = 0;
    while (b > 0 && m < 600) {
      const interest = b * monthlyRate;
      const principal = Math.min(emi - interest, b);
      if (principal <= 0) break;
      b -= principal;
      m++;
    }
    return m;
  })();

  const closureDate = new Date();
  closureDate.setMonth(closureDate.getMonth() + months);

  return {
    months,
    closureDate,
    totalInterest: Math.round(totalInterest),
    interestSaved: Math.round(
      (() => {
        let b = outstanding;
        let ti = 0;
        let m = 0;
        while (b > 0 && m < 600) {
          const interest = b * monthlyRate;
          ti += interest;
          const principal = Math.min(emi - interest, b);
          if (principal <= 0) break;
          b -= principal;
          m++;
        }
        return ti - totalInterest;
      })()
    ),
    baseMonths,
  };
}
