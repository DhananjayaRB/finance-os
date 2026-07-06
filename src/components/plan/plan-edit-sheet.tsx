"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOAN_TYPES, INSURANCE_TYPES, SAVING_TYPES } from "@/lib/constants";
import { PAYMENT_STATUS_META } from "@/lib/payment-status";
import { INCOME_TYPE_LABELS } from "@/lib/excel-template";
import type { ExcelPlanItem } from "@/lib/monthly-plan";
import type { PlanItemType } from "@/lib/monthly-plan";
import { X } from "lucide-react";

export interface EditContext {
  type: PlanItemType;
  item: ExcelPlanItem;
  isNew?: boolean;
}

interface PlanEditSheetProps {
  context: EditContext | null;
  onClose: () => void;
  onSave: (
    type: PlanItemType,
    id: string,
    data: Record<string, unknown>,
    isNew?: boolean
  ) => Promise<boolean>;
}

type PlanFormState = Record<string, string>;

function buildFormFromContext(context: EditContext): PlanFormState {
  const { item } = context;
  const received = item.isReceived ?? item.paymentStatus === "PAID";
  return {
    name: item.name,
    amount: String(item.amount || ""),
    outstanding: String(item.outstanding ?? ""),
    pendingEmi: String(item.pendingEmi ?? ""),
    emiDate: String(item.emiDate ?? ""),
    interestRate: String(item.interestRate ?? ""),
    payableAmount: String(item.payable ?? ""),
    paymentStatus: item.paymentStatus,
    loanType: item.loanType ?? "PERSONAL",
    incomeType: item.incomeType ?? "OTHER",
    insuranceType: item.insuranceType ?? "MEDICAL",
    savingType: item.savingType ?? "SIP",
    isReceived: received ? "true" : "false",
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
  onSave: PlanEditSheetProps["onSave"];
}) {
  const { type, item, isNew } = context;
  const nameRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PlanFormState>(() => buildFormFromContext(context));

  useEffect(() => {
    const timer = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  const title =
    isNew
      ? type === "saving" ? "Add Saving Goal" :
        type === "loan" ? "Add Loan EMI" :
        type === "home" ? "Add Home Expense" :
        "Add Item"
      : type === "loan" ? "Edit Loan EMI" :
        type === "home" ? "Edit Home Expense" :
        type === "saving" ? "Edit Saving" :
        type === "income" ? "Edit Income Source" :
        type === "subscription" ? "Edit Subscription" :
        type === "insurance" ? "Edit Insurance" :
        "Edit Fixed Expense";

  const handleStatusChange = (status: string) => {
    setForm((f) => {
      const next: PlanFormState = { ...f, paymentStatus: status };
      if (status === "PAID") {
        next.payableAmount = "0";
      } else if (status !== "CLOSED" && (parseFloat(f.payableAmount) || 0) <= 0) {
        next.payableAmount = f.amount || "0";
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const amount = parseFloat(form.amount) || 0;
      const payableAmount = parseFloat(form.payableAmount) || 0;
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        amount,
      };
      if (type === "loan") {
        payload.emiAmount = amount;
        payload.outstanding = parseFloat(form.outstanding) || 0;
        payload.pendingEmi = parseInt(form.pendingEmi) || 0;
        payload.emiDate = parseInt(form.emiDate) || 1;
        payload.interestRate = parseFloat(form.interestRate) || 0;
        payload.payableAmount =
          form.paymentStatus === "PAID" ? 0 : payableAmount;
        payload.paymentStatus = form.paymentStatus;
        payload.loanType = form.loanType;
      } else if (type === "home" || type === "saving" || type === "insurance" || type === "subscription") {
        payload.payableAmount =
          form.paymentStatus === "PAID" ? 0 : payableAmount;
        payload.paymentStatus = form.paymentStatus;
        if (type === "home" || type === "insurance") {
          payload.dueDay = parseInt(form.dueDay) || 1;
        }
        if (type === "saving") {
          payload.savingType = form.savingType;
          payload.dueDay = parseInt(form.dueDay) || 1;
        }
        if (type === "insurance") payload.insuranceType = form.insuranceType;
        if (type === "subscription") {
          payload.renewalDay = parseInt(form.renewalDay) || 1;
        }
      } else if (type === "monthly_fixed") {
        payload.amount = amount;
      } else if (type === "income") {
        payload.amount = amount;
        payload.incomeType = form.incomeType;
        payload.isReceived = form.isReceived === "true";
      }
      const ok = await onSave(type, item.id, payload, isNew);
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
                  {LOAN_TYPES.filter((t) =>
                    ["PERSONAL", "APP", "CREDIT_CARD", "HOME", "CAR", "OTHER"].includes(t.value)
                  ).map((t) => (
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

          {type === "saving" && (
            <div>
              <Label>Saving Type</Label>
              <select
                value={form.savingType}
                onChange={(e) => set("savingType", e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {SAVING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
            </div>
          )}

          {(type === "loan" || type === "home" || type === "saving" || type === "insurance" || type === "subscription") && (
            <div>
              <Label>Payable ₹ (amount still due)</Label>
              <Input
                type="number"
                value={form.payableAmount}
                onChange={(e) => set("payableAmount", e.target.value)}
                disabled={form.paymentStatus === "PAID"}
              />
            </div>
          )}

          {(type === "home" || type === "insurance" || type === "saving") && (
            <div>
              <Label>{type === "insurance" ? "Renewal Day" : type === "saving" ? "Due Day" : "Due Day"}</Label>
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
            <>
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
              <div>
                <Label>Status</Label>
                <select
                  value={form.isReceived}
                  onChange={(e) => set("isReceived", e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="true">Received — credited this month</option>
                  <option value="false">Not Received — still expecting</option>
                </select>
              </div>
            </>
          )}

          {(type === "loan" || type === "home" || type === "saving" || type === "insurance" || type === "subscription") && (
            <div>
              <Label>Payment Status</Label>
              <select
                value={form.paymentStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                {(["PAID", "PENDING", "DUE", "OVERDUE", "CLOSED"] as const).map((k) => (
                  <option key={k} value={k}>
                    {PAYMENT_STATUS_META[k].label} — {PAYMENT_STATUS_META[k].description}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Saving..." : isNew ? "Add" : "Save Changes"}
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
      key={`${context.isNew ? "new" : context.item.id}-${context.type}`}
      context={context}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
