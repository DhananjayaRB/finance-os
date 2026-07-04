"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOAN_TYPES, INSURANCE_TYPES } from "@/lib/constants";
import { PAYMENT_STATUS_META } from "@/lib/payment-status";
import { INCOME_TYPE_LABELS } from "@/lib/excel-template";
import type { ExcelPlanItem } from "@/lib/monthly-plan";
import type { PlanItemType } from "@/lib/monthly-plan";
import { X } from "lucide-react";

export interface EditContext {
  type: PlanItemType;
  item: ExcelPlanItem;
}

interface PlanEditSheetProps {
  context: EditContext | null;
  onClose: () => void;
  onSave: (type: PlanItemType, id: string, data: Record<string, unknown>) => Promise<boolean>;
}

function buildFormFromContext(context: EditContext): Record<string, string> {
  const { item } = context;
  return {
    name: item.name,
    amount: String(item.amount),
    outstanding: String(item.outstanding ?? ""),
    pendingEmi: String(item.pendingEmi ?? ""),
    emiDate: String(item.emiDate ?? ""),
    interestRate: String(item.interestRate ?? ""),
    payableAmount: String(item.payable),
    paymentStatus: item.paymentStatus,
    loanType: item.loanType ?? "PERSONAL",
    incomeType: item.incomeType ?? "OTHER",
    insuranceType: item.insuranceType ?? "MEDICAL",
    dueDay: String(item.emiDate ?? ""),
    renewalDay: String(item.emiDate ?? ""),
  };
}

function PlanEditForm({
  context,
  onClose,
  onSave,
}: {
  context: EditContext;
  onClose: () => void;
  onSave: (type: PlanItemType, id: string, data: Record<string, unknown>) => Promise<boolean>;
}) {
  const { type, item } = context;
  const nameRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => buildFormFromContext(context));

  useEffect(() => {
    const timer = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  const title =
    type === "loan" ? "Edit Loan EMI" :
    type === "home" ? "Edit Home Expense" :
    type === "saving" ? "Edit Saving" :
    type === "income" ? "Edit Income Source" :
    type === "subscription" ? "Edit Subscription" :
    type === "insurance" ? "Edit Insurance" :
    "Edit Fixed Expense";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        amount: parseFloat(form.amount) || 0,
      };
      if (type === "loan") {
        payload.emiAmount = parseFloat(form.amount) || 0;
        payload.outstanding = parseFloat(form.outstanding) || 0;
        payload.pendingEmi = parseInt(form.pendingEmi) || 0;
        payload.emiDate = parseInt(form.emiDate) || 1;
        payload.interestRate = parseFloat(form.interestRate) || 0;
        payload.payableAmount = parseFloat(form.payableAmount) || 0;
        payload.paymentStatus = form.paymentStatus;
        payload.loanType = form.loanType;
      } else if (type === "home" || type === "saving" || type === "insurance") {
        payload.payableAmount = parseFloat(form.payableAmount) || 0;
        payload.paymentStatus = form.paymentStatus;
        if (type === "home" || type === "insurance") payload.dueDay = parseInt(form.dueDay) || 1;
        if (type === "insurance") payload.insuranceType = form.insuranceType;
      } else if (type === "monthly_fixed") {
        payload.amount = parseFloat(form.amount) || 0;
      } else if (type === "income") {
        payload.amount = parseFloat(form.amount) || 0;
        payload.incomeType = form.incomeType;
      } else if (type === "subscription") {
        payload.amount = parseFloat(form.amount) || 0;
        payload.renewalDay = parseInt(form.renewalDay) || 1;
      }
      const ok = await onSave(type, item.id, payload);
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input ref={nameRef} value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>

          {type === "loan" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>EMI Amount ₹</Label>
                  <Input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
                </div>
                <div>
                  <Label>Outstanding ₹</Label>
                  <Input type="number" value={form.outstanding} onChange={(e) => set("outstanding", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Pending EMI</Label>
                  <Input type="number" value={form.pendingEmi} onChange={(e) => set("pendingEmi", e.target.value)} />
                </div>
                <div>
                  <Label>EMI Date</Label>
                  <Input type="number" min={1} max={28} value={form.emiDate} onChange={(e) => set("emiDate", e.target.value)} />
                </div>
                <div>
                  <Label>Interest %</Label>
                  <Input type="number" step="0.01" value={form.interestRate} onChange={(e) => set("interestRate", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Loan Type</Label>
                <select
                  value={form.loanType}
                  onChange={(e) => set("loanType", e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {LOAN_TYPES.filter((t) => ["PERSONAL", "APP", "CREDIT_CARD"].includes(t.value)).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {(type === "home" || type === "saving" || type === "monthly_fixed" || type === "income" || type === "subscription" || type === "insurance") && (
            <div>
              <Label>Amount ₹</Label>
              <Input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
          )}

          {(type === "loan" || type === "home" || type === "saving" || type === "insurance") && (
            <div>
              <Label>Payable ₹ (amount still due)</Label>
              <Input type="number" value={form.payableAmount} onChange={(e) => set("payableAmount", e.target.value)} />
            </div>
          )}

          {(type === "home" || type === "insurance") && (
            <div>
              <Label>{type === "insurance" ? "Renewal Day" : "Due Day"}</Label>
              <Input type="number" min={1} max={28} value={form.dueDay} onChange={(e) => set("dueDay", e.target.value)} />
            </div>
          )}

          {type === "subscription" && (
            <div>
              <Label>Renewal Day</Label>
              <Input type="number" min={1} max={28} value={form.renewalDay} onChange={(e) => set("renewalDay", e.target.value)} />
            </div>
          )}

          {type === "insurance" && (
            <div>
              <Label>Insurance Type</Label>
              <select
                value={form.insuranceType}
                onChange={(e) => set("insuranceType", e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {INSURANCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}

          {type === "income" && (
            <div>
              <Label>Income Type</Label>
              <select
                value={form.incomeType}
                onChange={(e) => set("incomeType", e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {Object.entries(INCOME_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}

          {(type === "loan" || type === "home" || type === "saving" || type === "insurance") && (
            <div>
              <Label>Payment Status</Label>
              <select
                value={form.paymentStatus}
                onChange={(e) => {
                  set("paymentStatus", e.target.value);
                  if (e.target.value === "PAID") set("payableAmount", "0");
                }}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {Object.entries(PAYMENT_STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} — {v.description}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PlanEditSheet({ context, onClose, onSave }: PlanEditSheetProps) {
  if (!context) return null;

  return (
    <PlanEditForm
      key={`${context.type}-${context.item.id}`}
      context={context}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
