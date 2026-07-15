"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  QUICK_AMOUNTS,
  PAYMENT_METHODS,
  EXPENSE_MERCHANTS,
  isBankPayment,
  type PaymentMethodValue,
} from "@/lib/constants";
import { getExpenseAreaMeta } from "@/lib/expense-areas";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const CLASSIFICATIONS = ["NEED", "WANT", "LUXURY"] as const;

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

export default function QuickAddPage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState<string>("Online Food");
  const [merchantDetail, setMerchantDetail] = useState("");
  const [classification, setClassification] = useState<string>(
    getExpenseAreaMeta("Online Food").classification
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState("");
  const [cashBoxId, setCashBoxId] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBoxOption[]>([]);
  const [saving, setSaving] = useState(false);

  const primaryAccount = accounts.find((a) => a.isPrimary) ?? accounts[0];
  const primaryCashBox = cashBoxes.find((b) => b.isPrimary) ?? cashBoxes[0];
  const showBank = isBankPayment(paymentMethod);
  const showCash = paymentMethod === "CASH";

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .catch(() => setAccounts([]));
    fetch("/api/cash-box")
      .then((r) => r.json())
      .then((d) => setCashBoxes(Array.isArray(d) ? d : []))
      .catch(() => setCashBoxes([]));
  }, []);

  useEffect(() => {
    if (showBank && primaryAccount && !accountId) {
      setAccountId(primaryAccount.id);
    }
  }, [showBank, primaryAccount, accountId]);

  useEffect(() => {
    if (showCash && primaryCashBox && !cashBoxId) {
      setCashBoxId(primaryCashBox.id);
    }
  }, [showCash, primaryCashBox, cashBoxId]);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          merchant,
          merchantDetail: merchantDetail.trim() || undefined,
          classification,
          paymentMethod,
          notes: notes.trim() || undefined,
          accountId: showBank ? accountId || primaryAccount?.id : undefined,
          cashBoxId: showCash ? cashBoxId || primaryCashBox?.id : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to add expense");
        return;
      }
      router.push("/expenses");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 dark:bg-zinc-950">
      <AppHeader title="Quick Add" subtitle="Less than 5 seconds" />

      <div className="space-y-6 p-4">
        <Link href="/expenses" className="inline-flex items-center gap-1 text-sm text-zinc-500">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-zinc-500">Amount</p>
            <div className="mt-2 flex items-center justify-center gap-1">
              <span className="text-3xl font-light text-zinc-400">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-40 bg-transparent text-center text-5xl font-bold outline-none"
                autoFocus
              />
            </div>
          </CardContent>
        </Card>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-500">Quick amounts</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(String(a))}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  amount === String(a)
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800"
                }`}
              >
                ₹{a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-500">Merchant area</p>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_MERCHANTS.map((m) => {
              const meta = getExpenseAreaMeta(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMerchant(m);
                    setClassification(meta.classification);
                  }}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    merchant === m
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800"
                  }`}
                >
                  <span className="mr-1">{meta.icon}</span>
                  {m}
                </button>
              );
            })}
          </div>
          <div className="mt-2">
            <Label>Detail (optional)</Label>
            <Input
              value={merchantDetail}
              onChange={(e) => setMerchantDetail(e.target.value)}
              placeholder="Brand / shop — e.g. Swiggy, DMart…"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-500">Payment method</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PAYMENT_METHODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPaymentMethod(p.value)}
                className={`rounded-xl px-2 py-2.5 text-xs font-medium ${
                  paymentMethod === p.value
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800"
                }`}
              >
                <span className="mr-1">{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {showBank && accounts.length > 0 && (
          <div>
            <Label>Bank account</Label>
            <select
              value={accountId || primaryAccount?.id || ""}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
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

        {showCash && cashBoxes.length > 0 && (
          <div>
            <Label>Cash box</Label>
            <select
              value={cashBoxId || primaryCashBox?.id || ""}
              onChange={(e) => setCashBoxId(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {cashBoxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {formatCurrency(Number(b.balance))}
                  {b.isPrimary ? " (Primary)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              Pick another box if your primary cash box has insufficient balance.
            </p>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-500">Classification</p>
          <div className="grid grid-cols-3 gap-2">
            {CLASSIFICATIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setClassification(c)}
                className={`rounded-xl py-2 text-xs font-medium ${
                  classification === c
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Notes (optional)</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note..."
            className="mt-1"
          />
        </div>

        <Button
          className="h-14 w-full text-lg"
          onClick={handleSave}
          disabled={saving || !amount}
        >
          {saving ? "Saving..." : `Save ${amount ? formatCurrency(parseFloat(amount)) : ""}`}
        </Button>
      </div>
    </div>
  );
}
