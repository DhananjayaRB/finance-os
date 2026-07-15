import type { ExpenseClass } from "@/generated/prisma/client";

export const DEFAULT_CATEGORIES: {
  name: string;
  classification: ExpenseClass;
  icon: string;
}[] = [
  { name: "Food", classification: "NEED", icon: "🍽️" },
  { name: "Groceries", classification: "NEED", icon: "🛒" },
  { name: "Rent", classification: "NEED", icon: "🏠" },
  { name: "Home Expense", classification: "NEED", icon: "🏡" },
  { name: "Parents", classification: "NEED", icon: "👨‍👩‍👧" },
  { name: "Fuel", classification: "NEED", icon: "⛽" },
  { name: "Metro", classification: "NEED", icon: "🚇" },
  { name: "Electricity", classification: "NEED", icon: "💡" },
  { name: "Water", classification: "NEED", icon: "💧" },
  { name: "Gas", classification: "NEED", icon: "🔥" },
  { name: "Internet", classification: "NEED", icon: "📶" },
  { name: "Society Maintenance", classification: "NEED", icon: "🏢" },
  { name: "Maid", classification: "NEED", icon: "🧹" },
  { name: "Medical", classification: "NEED", icon: "💊" },
  { name: "Loan EMI", classification: "NEED", icon: "🏦" },
  { name: "Recharge", classification: "NEED", icon: "📱" },
  { name: "Swiggy", classification: "WANT", icon: "🍔" },
  { name: "Zomato", classification: "WANT", icon: "🍕" },
  { name: "Zepto", classification: "WANT", icon: "⚡" },
  { name: "Blinkit", classification: "WANT", icon: "🛵" },
  { name: "Uber", classification: "WANT", icon: "🚗" },
  { name: "OLA", classification: "WANT", icon: "🚕" },
  { name: "Rapido", classification: "WANT", icon: "🏍️" },
  { name: "Amazon", classification: "WANT", icon: "📦" },
  { name: "Flipkart", classification: "WANT", icon: "🛍️" },
  { name: "Myntra", classification: "WANT", icon: "👕" },
  { name: "Subscriptions", classification: "WANT", icon: "📺" },
  { name: "Gym", classification: "WANT", icon: "💪" },
  { name: "Movies", classification: "WANT", icon: "🎬" },
  { name: "Coffee", classification: "WANT", icon: "☕" },
  { name: "Tea", classification: "WANT", icon: "🍵" },
  { name: "Shopping", classification: "WANT", icon: "🛒" },
  { name: "Vacation", classification: "LUXURY", icon: "✈️" },
  { name: "Gadgets", classification: "LUXURY", icon: "📱" },
  { name: "Expensive Restaurant", classification: "LUXURY", icon: "🍷" },
  { name: "SIP", classification: "SAVINGS", icon: "📈" },
  { name: "Gold", classification: "SAVINGS", icon: "🥇" },
  { name: "Mutual Fund", classification: "SAVINGS", icon: "💹" },
  { name: "FD", classification: "SAVINGS", icon: "🏛️" },
  { name: "PF", classification: "SAVINGS", icon: "💼" },
  { name: "PPF", classification: "SAVINGS", icon: "📊" },
  { name: "NPS", classification: "SAVINGS", icon: "🎯" },
  { name: "Donation", classification: "WANT", icon: "🙏" },
  { name: "Temple", classification: "WANT", icon: "🛕" },
  { name: "Pets", classification: "WANT", icon: "🐾" },
  { name: "Emergency", classification: "NEED", icon: "🚨" },
  { name: "Travel", classification: "WANT", icon: "🧳" },
  { name: "Parking", classification: "NEED", icon: "🅿️" },
  { name: "Education", classification: "NEED", icon: "📚" },
  { name: "Family", classification: "NEED", icon: "👪" },
  { name: "Investment", classification: "SAVINGS", icon: "💰" },
  { name: "Cash Withdrawal", classification: "NEED", icon: "💵" },
  { name: "Others", classification: "WANT", icon: "📋" },
];

export const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "Home" },
  { href: "/loans", label: "Loans", icon: "Landmark" },
  { href: "/expenses", label: "Expenses", icon: "Receipt" },
  { href: "/budget", label: "Budget", icon: "PieChart" },
  { href: "/profile", label: "Profile", icon: "User" },
] as const;

export const QUICK_AMOUNTS = [50, 100, 250, 500, 1000, 2000];

export {
  EXPENSE_AREAS,
  EXPENSE_AREA_NAMES,
  EXPENSE_MERCHANTS,
  resolveExpenseArea,
  getExpenseAreaMeta,
} from "@/lib/expense-areas";
export type { ExpenseAreaName, ExpenseMerchant } from "@/lib/expense-areas";

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash", icon: "💵" },
  { value: "UPI", label: "UPI", icon: "📱" },
  { value: "DEBIT_CARD", label: "Debit Card", icon: "💳" },
  { value: "CREDIT_CARD", label: "Credit Card", icon: "🏦" },
  { value: "NET_BANKING", label: "Net Banking", icon: "🌐" },
  { value: "AUTO_DEBIT", label: "Auto Debit", icon: "🔄" },
  { value: "OTHER", label: "Other", icon: "📋" },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]["value"];

export function isBankPayment(method: string) {
  return ["UPI", "DEBIT_CARD", "NET_BANKING", "AUTO_DEBIT", "OTHER"].includes(method);
}

export function getPaymentMethodLabel(method: string) {
  return PAYMENT_METHODS.find((p) => p.value === method)?.label ?? method.replace(/_/g, " ");
}

export const CASH_BOX_TYPES = [
  { value: "WALLET", label: "Wallet", icon: "👛" },
  { value: "HOME", label: "Home", icon: "🏠" },
  { value: "OFFICE", label: "Office", icon: "🏢" },
  { value: "EMERGENCY", label: "Emergency", icon: "🚨" },
  { value: "CUSTOM", label: "Custom", icon: "💵" },
] as const;

export const LOAN_TYPES = [
  { value: "PERSONAL", label: "Personal Loan", shortLabel: "Personal", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { value: "APP", label: "App Loan", shortLabel: "App", color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  { value: "CREDIT_CARD", label: "Credit Card", shortLabel: "Credit Card", color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  { value: "HOME", label: "Home Loan", shortLabel: "Home", color: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
  { value: "CAR", label: "Car Loan", shortLabel: "Car", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300" },
  { value: "OTHER", label: "Other", shortLabel: "Other", color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
] as const;

export type LoanTypeValue = (typeof LOAN_TYPES)[number]["value"];

const LOAN_TYPE_VALUES = new Set(LOAN_TYPES.map((t) => t.value));

export function parseLoanType(value: unknown): LoanTypeValue | undefined {
  if (typeof value !== "string") return undefined;
  const upper = value.toUpperCase();
  return LOAN_TYPE_VALUES.has(upper as LoanTypeValue) ? (upper as LoanTypeValue) : undefined;
}

export function getLoanTypeMeta(type: string) {
  return LOAN_TYPES.find((t) => t.value === type) ?? LOAN_TYPES.find((t) => t.value === "OTHER")!;
}

export const INSURANCE_TYPES = [
  { value: "MEDICAL", label: "Medical / Health", icon: "🏥" },
  { value: "LIFE", label: "Life Insurance", icon: "🛡️" },
  { value: "TERM", label: "Term Insurance", icon: "📋" },
  { value: "VEHICLE", label: "Vehicle", icon: "🚗" },
  { value: "CRITICAL_ILLNESS", label: "Critical Illness", icon: "💊" },
  { value: "OTHER", label: "Other", icon: "📄" },
] as const;

export type InsuranceTypeValue = (typeof INSURANCE_TYPES)[number]["value"];

export function getInsuranceTypeLabel(type: string) {
  return INSURANCE_TYPES.find((t) => t.value === type)?.label ?? type.replace(/_/g, " ");
}

export const SAVING_TYPES = [
  { value: "SIP", label: "SIP / Mutual Fund", icon: "📈" },
  { value: "GOLD", label: "Gold", icon: "🥇" },
  { value: "PF", label: "PF / EPF", icon: "💼" },
  { value: "PPF", label: "PPF", icon: "📊" },
  { value: "NPS", label: "NPS", icon: "🎯" },
  { value: "FD", label: "Fixed Deposit", icon: "🏛️" },
  { value: "RD", label: "Recurring Deposit", icon: "💹" },
  { value: "EMERGENCY_FUND", label: "Emergency Fund", icon: "🚨" },
  { value: "MUTUAL_FUND", label: "Mutual Fund", icon: "💰" },
  { value: "STOCKS", label: "Stocks", icon: "📉" },
  { value: "CASH", label: "Cash Savings", icon: "💵" },
  { value: "OTHER", label: "Other", icon: "📋" },
] as const;

export type SavingTypeValue = (typeof SAVING_TYPES)[number]["value"];

export function getSavingTypeLabel(type: string) {
  return SAVING_TYPES.find((t) => t.value === type)?.label ?? type.replace(/_/g, " ");
}

export function getSavingTypeIcon(type: string) {
  return SAVING_TYPES.find((t) => t.value === type)?.icon ?? "💰";
}

const APP_KEYWORDS = ["cashbee", "cashee", "cashier", "phone salary", "flexy salary", "kredit", "moneyview", "navi", "payme", "stashfin", "mpokket", "kissht", "slice", "fibe", "bel", "dmi"];
const CREDIT_CARD_KEYWORDS = ["hdfc rupay", "hdfc milania", "hdfc millenia", "millenia", "milania", "rupay", "credit card", "sbi card", "axis card", "icici card"];

export function inferLoanType(name: string): LoanTypeValue {
  const lower = name.toLowerCase();
  if (CREDIT_CARD_KEYWORDS.some((k) => lower.includes(k.trim()))) return "CREDIT_CARD";
  if (APP_KEYWORDS.some((k) => lower.includes(k.trim()))) return "APP";
  if (/\bmf\b|\bmv\b/.test(lower)) return "APP";
  return "PERSONAL";
}

