"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INCOME_TYPE_LABELS } from "@/lib/excel-template";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, ChevronLeft, ChevronRight, Landmark } from "lucide-react";

interface Income {
  id: string;
  source: string;
  incomeType: string;
  amount: number | string;
  date: string;
  isRecurring: boolean;
  account?: { id: string; name: string } | null;
}

interface BankAccount {
  id: string;
  name: string;
  isPrimary: boolean;
}

export default function IncomePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/income?month=${month}&year=${year}`).then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([incomeData, accountData]) => {
      setIncomes(incomeData.incomes || []);
      setTotal(incomeData.total || 0);
      setAccounts(accountData.accounts || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/income?month=${month}&year=${year}`).then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([incomeData, accountData]) => {
      if (!active) return;
      setIncomes(incomeData.incomes || []);
      setTotal(incomeData.total || 0);
      setAccounts(accountData.accounts || []);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, year]);

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setLoading(true);
    setMonth(m);
    setYear(y);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const accountId = form.get("accountId") as string;

    const res = await fetch("/api/income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: form.get("source"),
        amount: parseFloat(form.get("amount") as string),
        incomeType: form.get("incomeType"),
        isRecurring: form.get("isRecurring") === "on",
        accountId: accountId || undefined,
        month,
        year,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to add income");
      return;
    }

    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this income? Bank balance will be adjusted.")) return;
    const res = await fetch(`/api/income?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to delete");
      return;
    }
    load();
  };

  const monthLabel = new Date(year, month - 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
  const primaryAccount = accounts.find((a) => a.isPrimary) ?? accounts[0];

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Income" subtitle={`${monthLabel} • ${formatCurrency(total)} received`} />

      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => shiftMonth(-1)} className="rounded-xl p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="font-semibold">{monthLabel}</p>
          <button type="button" onClick={() => shiftMonth(1)} className="rounded-xl p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Adding income here credits your bank account automatically.
              {primaryAccount ? ` Default: ${primaryAccount.name}.` : " "}
              {!primaryAccount && (
                <Link href="/accounts" className="text-emerald-600 underline">Add a bank account first</Link>
              )}
            </p>
          </CardContent>
        </Card>

        <Button className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Income
        </Button>

        {showForm && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="font-semibold">New Income</p>
              <form onSubmit={handleSave} className="space-y-3">
                <Input name="source" placeholder="Source (Salary, HDFC, Bonus...)" required />
                <Input name="amount" type="number" placeholder="Amount ₹" required min="0" step="0.01" />
                <select
                  name="incomeType"
                  defaultValue="SALARY"
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {Object.entries(INCOME_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                {accounts.length > 0 && (
                  <select
                    name="accountId"
                    defaultValue={primaryAccount?.id ?? ""}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}{a.isPrimary ? " (Primary)" : ""}</option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isRecurring" />
                  Recurring income
                </label>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">Save & Credit Bank</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : incomes.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No income recorded for this month.</p>
        ) : (
          incomes.map((inc) => (
            <Card key={inc.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{inc.source}</p>
                  <p className="text-xs text-zinc-500">
                    {INCOME_TYPE_LABELS[inc.incomeType] ?? inc.incomeType}
                    {inc.isRecurring && " • Recurring"}
                  </p>
                  {inc.account && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600">
                      <Landmark className="h-3 w-3" /> Credited to {inc.account.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(Number(inc.amount))}</p>
                  <button type="button" onClick={() => handleDelete(inc.id)} className="rounded-lg p-2 text-zinc-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        <Link href="/plan" className="block text-center text-sm text-emerald-600 underline">
          View in Monthly Plan →
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
