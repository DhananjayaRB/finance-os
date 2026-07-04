"use client";

import { useEffect, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, Calendar, CreditCard, RefreshCw } from "lucide-react";

interface Subscription {
  id: string;
  name: string;
  amount: number | string;
  cycle: string;
  renewalDay: number | null;
  autoDebit: boolean;
  cardUsed: string | null;
  isActive: boolean;
  notes: string | null;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSub, setEditSub] = useState<Subscription | null>(null);

  const load = () => {
    fetch("/api/subscriptions")
      .then((r) => r.json())
      .then((d) => {
        setSubscriptions(d.subscriptions || []);
        setTotal(d.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const today = new Date().getDate();
  const yearlyTotal = subscriptions
    .filter((s) => s.isActive)
    .reduce((sum, s) => {
      const amt = Number(s.amount);
      if (s.cycle === "YEARLY") return sum + amt / 12;
      if (s.cycle === "QUARTERLY") return sum + amt / 3;
      return sum + amt;
    }, 0);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      id: editSub?.id,
      name: form.get("name"),
      amount: parseFloat(form.get("amount") as string),
      cycle: form.get("cycle"),
      renewalDay: parseInt(form.get("renewalDay") as string) || 1,
      autoDebit: form.get("autoDebit") === "on",
      cardUsed: form.get("cardUsed"),
      isActive: form.get("isActive") !== "off",
    };

    await fetch("/api/subscriptions", {
      method: editSub?.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setShowForm(false);
    setEditSub(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this subscription?")) return;
    await fetch(`/api/subscriptions?id=${id}`, { method: "DELETE" });
    load();
  };

  const toggleActive = async (sub: Subscription) => {
    await fetch("/api/subscriptions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sub.id, isActive: !sub.isActive }),
    });
    load();
  };

  const upcoming = subscriptions
    .filter((s) => s.isActive && s.renewalDay)
    .sort((a, b) => (a.renewalDay ?? 0) - (b.renewalDay ?? 0))
    .filter((s) => (s.renewalDay ?? 0) >= today)
    .slice(0, 3);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Subscriptions" subtitle={`${formatCurrency(total)}/mo • ${formatCurrency(yearlyTotal * 12)}/yr`} />

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-zinc-500">Monthly Total</p>
              <p className="text-lg font-bold text-amber-600">{formatCurrency(total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-zinc-500">Active</p>
              <p className="text-lg font-bold">{subscriptions.filter((s) => s.isActive).length}</p>
            </CardContent>
          </Card>
        </div>

        {upcoming.length > 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <p className="mb-2 flex items-center gap-1 text-sm font-medium">
                <Calendar className="h-4 w-4" /> Upcoming Renewals
              </p>
              {upcoming.map((s) => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span>{s.name}</span>
                  <span>{s.renewalDay}th • {formatCurrency(Number(s.amount))}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Button className="w-full" onClick={() => { setEditSub(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Add Subscription
        </Button>

        {showForm && (
          <Card>
            <CardContent className="p-4">
              <form onSubmit={handleSave} className="space-y-3">
                <Input name="name" placeholder="Netflix, Prime, Jio..." defaultValue={editSub?.name} required />
                <div className="grid grid-cols-2 gap-2">
                  <Input name="amount" type="number" placeholder="Amount ₹" defaultValue={editSub?.amount} required />
                  <select
                    name="cycle"
                    defaultValue={editSub?.cycle || "MONTHLY"}
                    className="h-11 rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="renewalDay" type="number" placeholder="Renewal day" defaultValue={editSub?.renewalDay ?? 1} min={1} max={28} />
                  <Input name="cardUsed" placeholder="Card used" defaultValue={editSub?.cardUsed ?? ""} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="autoDebit" defaultChecked={editSub?.autoDebit ?? true} />
                  Auto-debit enabled
                </label>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">Save</Button>
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
        ) : subscriptions.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No subscriptions yet</p>
        ) : (
          subscriptions.map((sub) => (
            <Card key={sub.id} className={!sub.isActive ? "opacity-50" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{sub.name}</h3>
                    <p className="text-sm text-zinc-500">
                      {sub.cycle} • {sub.renewalDay ? `${sub.renewalDay}th` : "—"}
                      {sub.autoDebit && " • Auto-debit"}
                    </p>
                    {sub.cardUsed && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
                        <CreditCard className="h-3 w-3" /> {sub.cardUsed}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(Number(sub.amount))}</p>
                    <p className="text-xs text-zinc-500">/{sub.cycle.toLowerCase().slice(0, 3)}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(sub)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {sub.isActive ? "Pause" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditSub(sub); setShowForm(true); }}
                    className="rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sub.id)}
                    className="rounded-lg p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
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
