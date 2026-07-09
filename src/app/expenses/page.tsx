"use client";

import { useEffect, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { getPaymentMethodLabel } from "@/lib/constants";
import {
  ExpenseEditSheet,
  type ExpenseFormData,
} from "@/components/expenses/expense-edit-sheet";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

interface Expense {
  id: string;
  amount: string | number;
  merchant: string | null;
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

function toFormData(exp: Expense): ExpenseFormData {
  return {
    id: exp.id,
    merchant: exp.merchant || "",
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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBoxOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editExpense, setEditExpense] = useState<ExpenseFormData | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/cash-box").then((r) => r.json()),
    ])
      .then(([expenseData, accountData, cashBoxData]) => {
        setExpenses(Array.isArray(expenseData) ? expenseData : []);
        setAccounts(accountData.accounts || []);
        setCashBoxes(Array.isArray(cashBoxData) ? cashBoxData : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const byClass = expenses.reduce(
    (acc, e) => {
      acc[e.classification] = (acc[e.classification] || 0) + Number(e.amount);
      return acc;
    },
    {} as Record<string, number>
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    const res = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to delete");
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleEditSave = async (data: ExpenseFormData): Promise<boolean> => {
    const res = await fetch("/api/expenses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: data.id,
        merchant: data.merchant,
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
    const updated = await res.json();
    setExpenses((prev) =>
      prev.map((e) => (e.id === data.id ? { ...e, ...updated } : e))
    );
    return true;
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Expenses" subtitle={`This month: ${formatCurrency(total)}`} />

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-4 gap-2">
          {(["NEED", "WANT", "LUXURY", "SAVINGS"] as const).map((cls) => (
            <Card key={cls}>
              <CardContent className="p-2 text-center">
                <p className="text-[10px] text-zinc-500">{cls}</p>
                <p className="text-sm font-semibold">{formatCurrency(byClass[cls] || 0)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Link href="/quick-add">
          <Button className="w-full">+ Quick Add Expense</Button>
        </Link>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : expenses.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No expenses this month</p>
        ) : (
          expenses.map((exp) => (
            <Card key={exp.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{exp.category?.icon || "💸"}</span>
                    <div className="min-w-0">
                      <p className="font-medium">{exp.merchant || "Expense"}</p>
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
          ))
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
