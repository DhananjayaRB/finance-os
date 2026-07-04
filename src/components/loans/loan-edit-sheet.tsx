"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOAN_TYPES } from "@/lib/constants";
import { X } from "lucide-react";

export interface LoanFormData {
  id?: string;
  name: string;
  outstanding: number;
  emiAmount: number;
  interestRate: number;
  emiDate: number;
  pendingEmi: number;
  loanType: string;
}

interface LoanEditSheetProps {
  open: boolean;
  loan: LoanFormData | null;
  onClose: () => void;
  onSave: (data: LoanFormData) => Promise<boolean>;
}

function buildForm(loan: LoanFormData | null): LoanFormData {
  return {
    id: loan?.id,
    name: loan?.name ?? "",
    outstanding: Number(loan?.outstanding) || 0,
    emiAmount: Number(loan?.emiAmount) || 0,
    interestRate: Number(loan?.interestRate) || 12,
    emiDate: Number(loan?.emiDate) || 5,
    pendingEmi: Number(loan?.pendingEmi) || 12,
    loanType: loan?.loanType ?? "PERSONAL",
  };
}

function LoanEditForm({
  loan,
  onClose,
  onSave,
}: {
  loan: LoanFormData | null;
  onClose: () => void;
  onSave: (data: LoanFormData) => Promise<boolean>;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => buildForm(loan));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  const set = (key: keyof LoanFormData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload: LoanFormData = {
        id: loan?.id,
        name: form.name.trim(),
        outstanding: parseFloat(String(form.outstanding)) || 0,
        emiAmount: parseFloat(String(form.emiAmount)) || 0,
        interestRate: parseFloat(String(form.interestRate)) || 0,
        emiDate: parseInt(String(form.emiDate)) || 1,
        pendingEmi: parseInt(String(form.pendingEmi)) || 0,
        loanType: form.loanType,
      };
      if (!payload.name) {
        setError("Loan name is required");
        return;
      }
      const ok = await onSave(payload);
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
          <h2 className="text-lg font-bold">{loan?.id ? "Edit Loan" : "Add Loan"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              ref={nameRef}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Loan Name"
              required
            />
          </div>
          <div>
            <Label>Loan Type</Label>
            <select
              value={form.loanType}
              onChange={(e) => set("loanType", e.target.value)}
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              required
            >
              {LOAN_TYPES.filter((t) =>
                ["PERSONAL", "APP", "CREDIT_CARD", "HOME", "CAR", "OTHER"].includes(t.value)
              ).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Outstanding ₹</Label>
              <Input type="number" value={form.outstanding || ""} onChange={(e) => set("outstanding", e.target.value)} required />
            </div>
            <div>
              <Label>EMI ₹</Label>
              <Input type="number" value={form.emiAmount || ""} onChange={(e) => set("emiAmount", e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Interest %</Label>
              <Input type="number" step="0.01" value={form.interestRate || ""} onChange={(e) => set("interestRate", e.target.value)} />
            </div>
            <div>
              <Label>EMI Date</Label>
              <Input type="number" min={1} max={28} value={form.emiDate || ""} onChange={(e) => set("emiDate", e.target.value)} />
            </div>
            <div>
              <Label>Pending EMI</Label>
              <Input type="number" value={form.pendingEmi || ""} onChange={(e) => set("pendingEmi", e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Saving..." : "Save Loan"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LoanEditSheet({ open, loan, onClose, onSave }: LoanEditSheetProps) {
  if (!open) return null;

  return (
    <LoanEditForm
      key={loan?.id ?? "new"}
      loan={loan}
      onClose={onClose}
      onSave={onSave}
    />
  );
}
