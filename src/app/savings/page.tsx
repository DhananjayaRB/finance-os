"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SAVING_TYPES, getSavingTypeIcon, getSavingTypeLabel } from "@/lib/constants";
import { formatCurrency, cn } from "@/lib/utils";
import { Plus, Trash2, ChevronLeft, ChevronRight, Pencil, X, PiggyBank } from "lucide-react";

interface MonthBreakdown {
  month: number;
  label: string;
  total: number;
}

interface SavingEntry {
  id: string;
  name: string;
  type: string;
  kind: string;
  amount: number;
  date: string;
  month: number;
  year: number;
  notes: string | null;
}

interface SavingsData {
  entries: SavingEntry[];
  monthTotal: number;
  monthDeposited?: number;
  monthWithdrawn?: number;
  monthMissed?: number;
  yearTotal: number;
  allTimeTotal: number;
  yearByMonth: MonthBreakdown[];
  byType: { type: string; total: number }[];
}

const SAVING_KINDS = [
  { value: "DEPOSIT", label: "Deposit — money saved" },
  { value: "WITHDRAWAL", label: "Withdrawal — money taken out" },
  { value: "MISSED", label: "Missed — planned but not saved" },
] as const;

function EditSheet({
  entry,
  month,
  year,
  onClose,
  onSaved,
}: {
  entry: SavingEntry | null;
  month: number;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  if (!entry) return null;
  const dateStr = entry.date.slice(0, 10);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/savings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: entry.id,
        name: form.get("name"),
        type: form.get("type"),
        kind: form.get("kind"),
        amount: parseFloat(form.get("amount") as string),
        date: form.get("date"),
        notes: form.get("notes"),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to update");
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Savings</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input name="name" defaultValue={entry.name} required />
          </div>
          <div>
            <Label>Activity</Label>
            <select name="kind" defaultValue={entry.kind || "DEPOSIT"} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900">
              {SAVING_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Type</Label>
            <select name="type" defaultValue={entry.type} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900">
              {SAVING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Amount ₹</Label>
              <Input name="amount" type="number" min="0" step="0.01" defaultValue={entry.amount} required />
            </div>
            <div>
              <Label>Date</Label>
              <Input name="date" type="date" defaultValue={dateStr} required />
            </div>
          </div>
          <Input name="notes" placeholder="Notes (optional)" defaultValue={entry.notes ?? ""} />
          <Button type="submit" className="w-full">Save Changes</Button>
        </form>
      </div>
    </div>
  );
}

export default function SavingsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<SavingEntry | null>(null);
  const [showConsolidated, setShowConsolidated] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`/api/savings?month=${month}&year=${year}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load");
        setData(d);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/savings?month=${month}&year=${year}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load");
        if (active) setData(d);
      })
      .catch((err) => {
        if (active) {
          setData(null);
          console.error(err);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, year]);

  const shiftMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/savings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        type: form.get("type"),
        amount: parseFloat(form.get("amount") as string),
        date: form.get("date"),
        notes: form.get("notes"),
        kind: form.get("kind") || "DEPOSIT",
        month,
        year,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to add savings");
      return;
    }
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this savings entry?")) return;
    const res = await fetch(`/api/savings?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to delete");
      return;
    }
    load();
  };

  const monthLabel = new Date(year, month - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const todayStr = now.toISOString().slice(0, 10);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader
        title="My Savings"
        subtitle={`${monthLabel} • ${formatCurrency(data?.monthTotal ?? 0)} saved`}
      />

      <EditSheet entry={editEntry} month={month} year={year} onClose={() => setEditEntry(null)} onSaved={load} />

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

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-zinc-500">Net Saved</p>
              <p className="text-sm font-bold text-emerald-600">{formatCurrency(data?.monthTotal ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-zinc-500">Deposited</p>
              <p className="text-sm font-bold">{formatCurrency(data?.monthDeposited ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-zinc-500">Withdrawn</p>
              <p className="text-sm font-bold text-rose-600">{formatCurrency(data?.monthWithdrawn ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-zinc-500">Missed</p>
              <p className="text-sm font-bold text-amber-600">{formatCurrency(data?.monthMissed ?? 0)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-zinc-500">{year} Total</p>
              <p className="text-sm font-bold">{formatCurrency(data?.yearTotal ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-zinc-500">All Time</p>
              <p className="text-sm font-bold text-indigo-600">{formatCurrency(data?.allTimeTotal ?? 0)}</p>
            </CardContent>
          </Card>
        </div>

        <Button className="w-full" onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Deposit / Withdrawal / Missed
        </Button>

        {showForm && (
          <Card className="border-emerald-200">
            <CardContent className="space-y-3 p-4">
              <p className="font-semibold">Log Savings Activity</p>
              <form onSubmit={handleSave} className="space-y-3">
                <select
                  name="kind"
                  defaultValue="DEPOSIT"
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {SAVING_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
                <Input name="name" placeholder="e.g. Rihsi RD, Gold SIP" required />
                <select
                  name="type"
                  defaultValue="SIP"
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {SAVING_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="amount" type="number" placeholder="Amount ₹" min="0" step="0.01" required />
                  <Input name="date" type="date" defaultValue={todayStr} required />
                </div>
                <Input name="notes" placeholder="Notes (optional)" />
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">Save</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <button
            type="button"
            className="flex w-full items-center justify-between p-4 text-left"
            onClick={() => setShowConsolidated((v) => !v)}
          >
            <span className="flex items-center gap-2 font-semibold">
              <PiggyBank className="h-4 w-4 text-emerald-600" /> Consolidated View — {year}
            </span>
            <span className="text-xs text-zinc-500">{showConsolidated ? "Hide" : "Show"}</span>
          </button>
          {showConsolidated && data && (
            <CardContent className="space-y-4 border-t p-4 pt-0">
              {data.byType.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-500">By type (this year)</p>
                  <div className="space-y-1">
                    {data.byType.map(({ type, total }) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span>{getSavingTypeIcon(type)} {getSavingTypeLabel(type)}</span>
                        <span className="font-medium">{formatCurrency(total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">Month-by-month ({year})</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {data.yearByMonth.map((m) => (
                    <button
                      key={m.month}
                      type="button"
                      onClick={() => { setMonth(m.month); setYear(year); }}
                      className={cn(
                        "rounded-lg border p-2 text-center text-[10px] transition-colors",
                        m.month === month
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                          : "border-zinc-200 dark:border-zinc-800",
                        m.total > 0 && m.month !== month && "bg-zinc-50 dark:bg-zinc-900"
                      )}
                    >
                      <p className="font-medium">{m.label}</p>
                      <p className={cn("mt-0.5", m.total > 0 ? "text-emerald-600" : "text-zinc-400")}>
                        {m.total > 0 ? formatCurrency(m.total) : "—"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <p className="text-xs font-medium text-zinc-500">Entries in {monthLabel}</p>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : !data?.entries.length ? (
          <p className="py-8 text-center text-zinc-500">No savings logged this month. Tap Add above.</p>
        ) : (
          data.entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex gap-3">
                  <span className="text-2xl">{getSavingTypeIcon(entry.type)}</span>
                  <div>
                    <p className="font-medium">{entry.name}</p>
                    <p className="text-xs text-zinc-500">
                      {entry.kind === "WITHDRAWAL" ? "Withdrawal" : entry.kind === "MISSED" ? "Missed" : "Deposit"} • {getSavingTypeLabel(entry.type)} • {new Date(entry.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                    {entry.notes && <p className="text-xs text-zinc-400">{entry.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <p
                    className={cn(
                      "text-lg font-bold",
                      entry.kind === "WITHDRAWAL"
                        ? "text-rose-600"
                        : entry.kind === "MISSED"
                          ? "text-amber-600"
                          : "text-emerald-600"
                    )}
                  >
                    {entry.kind === "WITHDRAWAL" ? "−" : entry.kind === "MISSED" ? "" : ""}
                    {formatCurrency(entry.amount)}
                  </p>
                  <button type="button" onClick={() => setEditEntry(entry)} className="rounded-lg p-2 text-zinc-400 hover:text-zinc-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleDelete(entry.id)} className="rounded-lg p-2 text-zinc-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        <Link href="/plan" className="block text-center text-sm text-emerald-600 underline">
          Compare with Monthly Plan →
        </Link>
      </div>

      <BottomNav />
    </div>
  );
}
