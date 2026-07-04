"use client";

import { useCallback, useEffect, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Plus, Pencil, Trash2, Star, RefreshCw } from "lucide-react";

interface BankAccount {
  id: string;
  name: string;
  bankName: string | null;
  balance: number;
  isPrimary: boolean;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState<BankAccount | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/accounts")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load accounts");
        setAccounts(d.accounts || []);
        setTotal(d.total || 0);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const openAdd = () => {
    setEditAccount(null);
    setAdjustAmount("");
    setError("");
    setShowForm(true);
  };

  const openEdit = (account: BankAccount) => {
    setEditAccount(account);
    setAdjustAmount("");
    setError("");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const body = {
      id: editAccount?.id,
      name: form.get("name"),
      bankName: form.get("bankName"),
      balance: parseFloat(form.get("balance") as string) || 0,
      isPrimary: form.get("isPrimary") === "on",
    };

    const res = await fetch("/api/accounts", {
      method: editAccount?.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to save account");
      return;
    }

    setShowForm(false);
    setEditAccount(null);
    load();
  };

  const handleAdjust = async (direction: "in" | "out") => {
    if (!editAccount?.id || !adjustAmount) return;
    const amount = parseFloat(adjustAmount);
    if (!amount || amount <= 0) return;

    setError("");
    const res = await fetch("/api/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editAccount.id,
        adjustment: direction === "in" ? amount : -amount,
        description: direction === "in" ? "Balance added" : "Balance removed",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to adjust balance");
      return;
    }

    setAdjustAmount("");
    setShowForm(false);
    setEditAccount(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this bank account?")) return;
    setError("");
    const res = await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to delete account");
      return;
    }
    load();
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Bank Accounts" subtitle={`Total balance: ${formatCurrency(total)}`} />

      <div className="space-y-3 p-4">
        <p className="text-xs text-zinc-500">
          Income credits and UPI/card expenses auto-adjust the primary account balance.
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{error}</p>
        )}

        <div className="flex gap-2">
          <Button className="flex-1" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" /> Add Bank Account
          </Button>
          <Button variant="outline" size="icon" onClick={load} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="font-semibold">{editAccount ? "Edit Account" : "New Bank Account"}</p>
              <form key={editAccount?.id ?? "new"} onSubmit={handleSave} className="space-y-3">
                <Input name="name" placeholder="Account name (e.g. HDFC Salary)" defaultValue={editAccount?.name} required />
                <Input name="bankName" placeholder="Bank name (optional)" defaultValue={editAccount?.bankName ?? ""} />
                <Input
                  name="balance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Current balance ₹"
                  defaultValue={editAccount != null ? editAccount.balance : ""}
                  required={!editAccount}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isPrimary" defaultChecked={editAccount?.isPrimary ?? !editAccount} />
                  Primary account (default for income & expenses)
                </label>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">Save</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>

              {editAccount && (
                <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <p className="mb-2 text-sm font-medium text-zinc-500">Quick adjust</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Amount ₹"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      min="0"
                    />
                    <Button type="button" variant="outline" onClick={() => handleAdjust("in")}>+ Credit</Button>
                    <Button type="button" variant="outline" onClick={() => handleAdjust("out")}>- Debit</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No bank accounts yet. Add your HDFC or salary account.</p>
        ) : (
          accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏦</span>
                  <div>
                    <p className="flex items-center gap-1 font-medium">
                      {account.name}
                      {account.isPrimary && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                    </p>
                    {account.bankName && (
                      <p className="text-xs text-zinc-500">{account.bankName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold">{formatCurrency(account.balance)}</p>
                  <button type="button" onClick={() => openEdit(account)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleDelete(account.id)} className="rounded-lg p-2 text-zinc-400 hover:text-red-500">
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
