"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QUICK_AMOUNTS, PAYMENT_METHODS, type PaymentMethodValue } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const CLASSIFICATIONS = ["NEED", "WANT", "LUXURY", "SAVINGS"] as const;
const MERCHANTS = ["Swiggy", "Zomato", "Zepto", "Metro", "Amazon", "Food", "Fuel", "Others"];

export default function QuickAddPage() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("Swiggy");
  const [classification, setClassification] = useState<string>("WANT");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setSaving(true);
    try {
      await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          merchant,
          classification,
          paymentMethod,
        }),
      });
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
          <p className="mb-2 text-sm font-medium text-zinc-500">Merchant</p>
          <div className="flex flex-wrap gap-2">
            {MERCHANTS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMerchant(m)}
                className={`rounded-xl px-3 py-2 text-sm ${
                  merchant === m
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800"
                }`}
              >
                {m}
              </button>
            ))}
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

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-500">Classification</p>
          <div className="grid grid-cols-4 gap-2">
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
