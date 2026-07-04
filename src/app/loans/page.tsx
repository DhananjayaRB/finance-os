"use client";

import { useEffect, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, calculateLoanClosure, cn } from "@/lib/utils";
import { getLoanTypeMeta } from "@/lib/constants";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { LoanEditSheet, type LoanFormData } from "@/components/loans/loan-edit-sheet";

interface Loan {
  id: string;
  name: string;
  outstanding: string | number;
  emiAmount: string | number;
  interestRate: string | number;
  emiDate: number;
  pendingEmi: number;
  status: string;
  loanType: string;
}

type FilterType = "ALL" | "PERSONAL" | "APP" | "CREDIT_CARD";

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editLoan, setEditLoan] = useState<LoanFormData | null>(null);
  const [extraPayment, setExtraPayment] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<FilterType>("ALL");

  const loadLoans = () => {
    fetch("/api/loans")
      .then((r) => r.json())
      .then(setLoans)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLoans(); }, []);

  const activeLoans = loans.filter((l) => l.status === "ACTIVE");
  const filteredLoans = filter === "ALL"
    ? activeLoans
    : activeLoans.filter((l) => l.loanType === filter);

  const totalEmi = activeLoans.reduce((s, l) => s + Number(l.emiAmount), 0);
  const totalOutstanding = activeLoans.reduce((s, l) => s + Number(l.outstanding), 0);

  const byType = (type: string) => {
    const items = activeLoans.filter((l) => l.loanType === type);
    return {
      count: items.length,
      emi: items.reduce((s, l) => s + Number(l.emiAmount), 0),
    };
  };

  const openAdd = () => {
    setEditLoan({
      name: "",
      outstanding: 0,
      emiAmount: 0,
      interestRate: 12,
      emiDate: 5,
      pendingEmi: 12,
      loanType: "PERSONAL",
    });
    setShowForm(true);
  };

  const openEdit = (loan: Loan) => {
    setEditLoan({
      id: loan.id,
      name: loan.name,
      outstanding: Number(loan.outstanding),
      emiAmount: Number(loan.emiAmount),
      interestRate: Number(loan.interestRate),
      emiDate: loan.emiDate,
      pendingEmi: loan.pendingEmi,
      loanType: loan.loanType,
    });
    setShowForm(true);
  };

  const handleSave = async (data: LoanFormData): Promise<boolean> => {
    const res = await fetch("/api/loans", {
      method: data.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to save loan");
      return false;
    }
    loadLoans();
    return true;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this loan?")) return;
    await fetch(`/api/loans?id=${id}`, { method: "DELETE" });
    loadLoans();
  };

  const primaryTypes: FilterType[] = ["ALL", "PERSONAL", "APP", "CREDIT_CARD"];

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Loan Manager" subtitle={`Total EMI: ${formatCurrency(totalEmi)}`} />

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-zinc-500">Total EMI</p>
              <p className="text-lg font-bold text-orange-600">{formatCurrency(totalEmi)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-zinc-500">Outstanding</p>
              <p className="text-lg font-bold">{formatCurrency(totalOutstanding)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Loan type summary */}
        <div className="grid grid-cols-3 gap-2">
          {(["PERSONAL", "APP", "CREDIT_CARD"] as const).map((type) => {
            const meta = getLoanTypeMeta(type);
            const stats = byType(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => setFilter(type)}
                className={cn(
                  "rounded-xl border p-2 text-left transition-colors",
                  filter === type
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-zinc-200 dark:border-zinc-800"
                )}
              >
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", meta.color)}>
                  {meta.shortLabel}
                </span>
                <p className="mt-1 text-sm font-bold">{formatCurrency(stats.emi)}</p>
                <p className="text-[10px] text-zinc-500">{stats.count} loans</p>
              </button>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {primaryTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilter(type)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                filter === type
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              )}
            >
              {type === "ALL" ? "All Loans" : getLoanTypeMeta(type).label}
            </button>
          ))}
        </div>

        <Button className="w-full" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Loan
        </Button>

        <LoanEditSheet
          open={showForm}
          loan={editLoan}
          onClose={() => { setShowForm(false); setEditLoan(null); }}
          onSave={handleSave}
        />

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : filteredLoans.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No loans in this category</p>
        ) : (
          filteredLoans.map((loan) => {
            const extra = extraPayment[loan.id] || 0;
            const closure = calculateLoanClosure(
              Number(loan.outstanding),
              Number(loan.emiAmount),
              Number(loan.interestRate),
              extra
            );
            const typeMeta = getLoanTypeMeta(loan.loanType);

            return (
              <Card key={loan.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{loan.name}</h3>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", typeMeta.color)}>
                          {typeMeta.shortLabel}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500">
                        EMI {formatCurrency(Number(loan.emiAmount))} • {loan.emiDate}th • {loan.interestRate}%
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(loan)}
                        className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        aria-label="Edit loan"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(loan.id)}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
                      <p className="text-xs text-zinc-500">Outstanding</p>
                      <p className="font-medium">{formatCurrency(Number(loan.outstanding))}</p>
                    </div>
                    <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
                      <p className="text-xs text-zinc-500">Pending</p>
                      <p className="font-medium">{loan.pendingEmi} mo</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/30">
                      <p className="text-xs text-zinc-500">Closure</p>
                      <p className="font-medium text-emerald-600">{closure.months} mo</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-xs text-zinc-500">Extra EMI (planner)</label>
                    <Input
                      type="number"
                      placeholder="₹0"
                      value={extra || ""}
                      onChange={(e) =>
                        setExtraPayment((prev) => ({
                          ...prev,
                          [loan.id]: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="mt-1"
                    />
                    {extra > 0 && (
                      <p className="mt-1 text-xs text-emerald-600">
                        Interest saved: {formatCurrency(closure.interestSaved)} •{" "}
                        {closure.baseMonths - closure.months} months faster
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
