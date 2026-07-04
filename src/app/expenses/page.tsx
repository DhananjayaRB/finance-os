"use client";

import { useEffect, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { getPaymentMethodLabel } from "@/lib/constants";
import { Trash2 } from "lucide-react";
import Link from "next/link";

interface Expense {
  id: string;
  amount: string | number;
  merchant: string | null;
  classification: string;
  paymentMethod: string;
  date: string;
  category?: { name: string; icon: string | null } | null;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/expenses")
      .then((r) => r.json())
      .then(setExpenses)
      .finally(() => setLoading(false));
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
    await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((e) => e.id !== id));
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
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{exp.category?.icon || "💸"}</span>
                  <div>
                    <p className="font-medium">{exp.merchant || "Expense"}</p>
                    <p className="text-xs text-zinc-500">
                      {exp.classification} • {getPaymentMethodLabel(exp.paymentMethod)} •{" "}
                      {new Date(exp.date).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-600">
                    -{formatCurrency(Number(exp.amount))}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(exp.id)}
                    className="rounded p-1 text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
