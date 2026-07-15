"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import { getPaymentMethodLabel } from "@/lib/constants";
import { getExpenseAreaMeta, resolveExpenseArea } from "@/lib/expense-areas";
import {
  ExpenseEditSheet,
  type ExpenseFormData,
} from "@/components/expenses/expense-edit-sheet";
import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const CLASSIFICATIONS = ["NEED", "WANT", "LUXURY"] as const;
type Classification = (typeof CLASSIFICATIONS)[number];

interface Expense {
  id: string;
  amount: string | number;
  merchant: string | null;
  merchantDetail?: string | null;
  classification: string;
  paymentMethod: string;
  notes: string | null;
  date: string;
  account?: { id: string; name: string } | null;
  cashBox?: { id: string; name: string } | null;
  category?: { name: string; icon: string | null } | null;
}

interface BankAccount {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface CashBoxOption {
  id: string;
  name: string;
  balance: string | number;
  isPrimary: boolean;
}

interface PlannedExpense {
  name: string;
  amount: number;
  sourceId: string | null;
}

interface MerchantTotal {
  name: string;
  icon: string;
  amount: number;
}

function toFormData(exp: Expense): ExpenseFormData {
  const area = resolveExpenseArea(exp.merchant, exp.notes, exp.category?.name);
  const original = (exp.merchant || "").trim();
  const detail =
    exp.merchantDetail ||
    (original && original.toLowerCase() !== area.toLowerCase() ? original : "");
  return {
    id: exp.id,
    merchant: area,
    merchantDetail: detail,
    amount: Number(exp.amount),
    classification: exp.classification,
    paymentMethod: exp.paymentMethod,
    notes: exp.notes || "",
    date: new Date(exp.date).toISOString().slice(0, 10),
    accountId: exp.account?.id || "",
    cashBoxId: exp.cashBox?.id || "",
  };
}

export default function ExpensesPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [byMerchant, setByMerchant] = useState<MerchantTotal[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBoxOption[]>([]);
  const [plannedExpense, setPlannedExpense] = useState<PlannedExpense>({
    name: "Dhanu Expense",
    amount: 0,
    sourceId: null,
  });
  const [loading, setLoading] = useState(true);
  const [editExpense, setEditExpense] = useState<ExpenseFormData | null>(null);
  const [filterClass, setFilterClass] = useState<Classification | "ALL">("ALL");
  const [filterMerchant, setFilterMerchant] = useState<string>("ALL");

  const monthLabel = `${MONTHS[month - 1]} ${year}`;

  const load = useCallback(() => {
    setLoading(true);
    const readJson = async (r: Response) => {
      const text = await r.text();
      if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
      if (!text) return null;
      return JSON.parse(text);
    };
    Promise.all([
      fetch(`/api/expenses?month=${month}&year=${year}`).then(readJson),
      fetch("/api/accounts").then(readJson),
      fetch("/api/cash-box").then(readJson),
    ])
      .then(([expenseData, accountData, cashBoxData]) => {
        if (Array.isArray(expenseData)) {
          setExpenses(expenseData);
          setByMerchant([]);
        } else {
          setExpenses(Array.isArray(expenseData?.expenses) ? expenseData.expenses : []);
          setByMerchant(Array.isArray(expenseData?.byMerchant) ? expenseData.byMerchant : []);
          const planned = expenseData?.plannedExpense;
          setPlannedExpense({
            name: planned?.name || "Dhanu Expense",
            amount: Number(planned?.amount) || 0,
            sourceId: planned?.sourceId || null,
          });
        }
        setAccounts(accountData?.accounts || []);
        setCashBoxes(Array.isArray(cashBoxData) ? cashBoxData : []);
      })
      .catch((err) => {
        console.error("Failed to load expenses:", err);
        setExpenses([]);
        setByMerchant([]);
      })
      .finally(() => setLoading(false));
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setFilterClass("ALL");
    setFilterMerchant("ALL");
    setMonth(m);
    setYear(y);
  };

  const byClass = useMemo(
    () =>
      expenses.reduce(
        (acc, e) => {
          acc[e.classification] = (acc[e.classification] || 0) + Number(e.amount);
          return acc;
        },
        {} as Record<string, number>
      ),
    [expenses]
  );

  const merchantTotals = useMemo(() => {
    if (byMerchant.length > 0) {
      return [...byMerchant].sort((a, b) => b.amount - a.amount);
    }
    const map = new Map<string, number>();
    for (const exp of expenses) {
      const key = exp.merchant || "Others";
      map.set(key, (map.get(key) || 0) + Number(exp.amount));
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({
        name,
        icon: getExpenseAreaMeta(name).icon,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [byMerchant, expenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filterClass !== "ALL" && e.classification !== filterClass) return false;
      if (filterMerchant !== "ALL" && (e.merchant || "Others") !== filterMerchant) {
        return false;
      }
      return true;
    });
  }, [expenses, filterClass, filterMerchant]);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const filteredTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const plannedAmount = plannedExpense.amount;
  const diffTotal = plannedAmount - total;
  const topLeak = merchantTotals.find((m) => m.amount > 0);

  const toggleFilter = (cls: Classification) => {
    setFilterClass((prev) => (prev === cls ? "ALL" : cls));
  };

  const toggleMerchant = (name: string) => {
    setFilterMerchant((prev) => (prev === name ? "ALL" : name));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const res = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to delete");
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    load();
  };

  const handleEditSave = async (data: ExpenseFormData): Promise<boolean> => {
    const res = await fetch("/api/expenses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: data.id,
        merchant: data.merchant,
        merchantDetail: data.merchantDetail || undefined,
        amount: data.amount,
        classification: data.classification,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        date: data.date,
        accountId: data.accountId || undefined,
        cashBoxId: data.cashBoxId || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to update expense");
      return false;
    }
    load();
    return true;
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader
        title="Expenses"
        subtitle={`${monthLabel}: ${formatCurrency(total)}`}
      />

      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-xl p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-lg font-bold">{monthLabel}</p>
            <p className="text-xs text-zinc-500">
              {filterMerchant !== "ALL"
                ? `${filterMerchant}: ${formatCurrency(filteredTotal)}`
                : filterClass === "ALL"
                  ? `${expenses.length} expense${expenses.length === 1 ? "" : "s"}`
                  : `${filterClass}: ${formatCurrency(filteredTotal)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-xl p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <Card className="border-emerald-200 dark:border-emerald-900">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Planned vs Actual</p>
                <p className="text-[10px] text-zinc-500">
                  Planned = Plan item “{plannedExpense.name}” only
                </p>
              </div>
              <Link
                href="/plan"
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
              >
                Edit in Plan →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900">
                <p className="text-zinc-500">Planned</p>
                <p className="text-sm font-bold">{formatCurrency(plannedAmount)}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900">
                <p className="text-zinc-500">Actual</p>
                <p className="text-sm font-bold text-red-600">{formatCurrency(total)}</p>
              </div>
              <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-900">
                <p className="text-zinc-500">Difference</p>
                <p
                  className={cn(
                    "text-sm font-bold",
                    diffTotal >= 0 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {diffTotal >= 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(diffTotal))}
                </p>
              </div>
            </div>

            {topLeak && total > plannedAmount && (
              <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Biggest spend area: <strong>{topLeak.icon} {topLeak.name}</strong>{" "}
                ({formatCurrency(topLeak.amount)}) — tap below to drill down.
              </p>
            )}
          </CardContent>
        </Card>

        <div>
          <p className="mb-2 text-xs font-semibold text-zinc-500">
            Spend by area (tap to filter)
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {merchantTotals
              .filter((m) => m.amount > 0)
              .map((m) => {
                const active = filterMerchant === m.name;
                const pct = total > 0 ? Math.round((m.amount / total) * 100) : 0;
                return (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => toggleMerchant(m.name)}
                    className={cn(
                      "min-w-[7.5rem] shrink-0 rounded-xl border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30 dark:bg-emerald-950/40"
                        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                    )}
                  >
                    <p className="truncate text-[11px] font-medium">
                      {m.icon} {m.name}
                    </p>
                    <p className="text-sm font-bold">{formatCurrency(m.amount)}</p>
                    <p className="text-[10px] text-zinc-400">{pct}% of month</p>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {CLASSIFICATIONS.map((cls) => {
            const active = filterClass === cls;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => toggleFilter(cls)}
                className="text-left"
                aria-pressed={active}
              >
                <Card
                  className={cn(
                    "transition-colors",
                    active && "border-emerald-500 ring-2 ring-emerald-500/40"
                  )}
                >
                  <CardContent className="p-2 text-center">
                    <p
                      className={cn(
                        "text-[10px]",
                        active ? "font-semibold text-emerald-600" : "text-zinc-500"
                      )}
                    >
                      {cls}
                    </p>
                    <p className="text-sm font-semibold">
                      {formatCurrency(byClass[cls] || 0)}
                    </p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        {(filterClass !== "ALL" || filterMerchant !== "ALL") && (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs dark:bg-emerald-950/40">
            <span className="font-medium text-emerald-700 dark:text-emerald-300">
              {[
                filterMerchant !== "ALL" ? filterMerchant : null,
                filterClass !== "ALL" ? filterClass : null,
              ]
                .filter(Boolean)
                .join(" · ")}{" "}
              ({filteredExpenses.length}) — {formatCurrency(filteredTotal)}
            </span>
            <button
              type="button"
              onClick={() => {
                setFilterClass("ALL");
                setFilterMerchant("ALL");
              }}
              className="font-semibold text-emerald-700 underline dark:text-emerald-300"
            >
              Clear
            </button>
          </div>
        )}

        <Link href="/quick-add">
          <Button className="w-full">+ Quick Add Expense</Button>
        </Link>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">
            No expenses match this filter in {monthLabel}
          </p>
        ) : (
          filteredExpenses.map((exp) => {
            const area = getExpenseAreaMeta(exp.merchant || "Others");
            return (
              <Card key={exp.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {area.icon || exp.category?.icon || "💸"}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {exp.merchant || "Expense"}
                          {exp.merchantDetail ? (
                            <span className="ml-1 text-xs font-normal text-zinc-400">
                              ({exp.merchantDetail})
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {exp.classification} • {getPaymentMethodLabel(exp.paymentMethod)}
                          {exp.account ? ` • ${exp.account.name}` : ""}
                          {exp.cashBox ? ` • ${exp.cashBox.name}` : ""} •{" "}
                          {new Date(exp.date).toLocaleDateString("en-IN")}
                        </p>
                        {exp.notes && (
                          <p className="mt-0.5 truncate text-xs text-zinc-400">{exp.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-semibold text-red-600">
                      -{formatCurrency(Number(exp.amount))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditExpense(toFormData(exp))}
                      className="rounded p-1 text-zinc-400 hover:text-emerald-600"
                      aria-label="Edit expense"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(exp.id)}
                      className="rounded p-1 text-zinc-400 hover:text-red-500"
                      aria-label="Delete expense"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {editExpense && (
        <ExpenseEditSheet
          expense={editExpense}
          accounts={accounts}
          cashBoxes={cashBoxes}
          onClose={() => setEditExpense(null)}
          onSave={handleEditSave}
        />
      )}

      <BottomNav />
    </div>
  );
}
