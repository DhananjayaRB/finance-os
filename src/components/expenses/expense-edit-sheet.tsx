"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHODS, isBankPayment } from "@/lib/constants";
import { X } from "lucide-react";

const CLASSIFICATIONS = ["NEED", "WANT", "LUXURY", "SAVINGS"] as const;

export interface ExpenseFormData {
  id: string;
  merchant: string;
  amount: number | string;
  classification: string;
  paymentMethod: string;
  notes: string;
  date: string;
  accountId: string;
}

interface BankAccount {
  id: string;
  name: string;
  isPrimary: boolean;
}

export function ExpenseEditSheet({
  expense,
  accounts,
  onClose,
  onSave,
}: {
  expense: ExpenseFormData;
  accounts: BankAccount[];
  onClose: () => void;
  onSave: (data: ExpenseFormData) => Promise<boolean>;
}) {
  const [form, setForm] = useState(expense);
  const [saving, setSaving] = useState(false);
  const primaryAccount = accounts.find((a) => a.isPrimary) ?? accounts[0];
  const showBank = isBankPayment(form.paymentMethod);

  useEffect(() => {
    if (showBank && !form.accountId && primaryAccount) {
      setForm((f) => ({ ...f, accountId: primaryAccount.id }));
    }
  }, [showBank, form.accountId, primaryAccount]);

  const set = <K extends keyof ExpenseFormData>(key: K, value: ExpenseFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const ok = await onSave({
        ...form,
        merchant: form.merchant.trim(),
        amount: parseFloat(String(form.amount)) || 0,
        notes: form.notes.trim(),
      });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Expense</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Merchant / Description</Label>
            <Input
              value={form.merchant}
              onChange={(e) => set("merchant", e.target.value)}
              placeholder="Swiggy, Metro, Fuel..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Amount ₹</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label>Payment method</Label>
            <select
              value={form.paymentMethod}
              onChange={(e) => set("paymentMethod", e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.icon} {p.label}
                </option>
              ))}
            </select>
          </div>

          {showBank && accounts.length > 0 && (
            <div>
              <Label>Bank account</Label>
              <select
                value={form.accountId || primaryAccount?.id || ""}
                onChange={(e) => set("accountId", e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.isPrimary ? " (Primary)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label>Classification</Label>
            <select
              value={form.classification}
              onChange={(e) => set("classification", e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
