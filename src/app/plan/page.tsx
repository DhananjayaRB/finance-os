"use client";

import { useEffect, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import { PlanEditSheet, type EditContext } from "@/components/plan/plan-edit-sheet";
import type { PlanItemType } from "@/lib/monthly-plan";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Info,
  Pencil,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import Link from "next/link";
import type { ExcelMonthlyPlan, ExcelPlanItem } from "@/lib/monthly-plan";

const INSIGHT_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-600" />,
  critical: <AlertTriangle className="h-4 w-4 text-red-600" />,
  info: <Info className="h-4 w-4 text-blue-600" />,
};

function StatusBadge({ item }: { item: ExcelPlanItem }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", item.statusColor)}>
      {item.statusLabel}
    </span>
  );
}

function PlanTable({
  title,
  headers,
  rows,
  onMarkPaid,
  onEdit,
  type,
  manageHref,
}: {
  title: string;
  headers: string[];
  rows: ExcelPlanItem[];
  onMarkPaid?: (type: "loan" | "home" | "saving" | "insurance", id: string) => void;
  onEdit?: (type: PlanItemType, item: ExcelPlanItem) => void;
  type?: PlanItemType;
  manageHref?: string;
}) {
  if (rows.length === 0) return null;

  const canEdit = Boolean(onEdit && type);

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-indigo-600 px-3 py-2 dark:border-zinc-800">
          <p className="text-sm font-semibold text-white">{title}</p>
          {manageHref && (
            <Link
              href={manageHref}
              className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-indigo-100 hover:text-white"
            >
              Manage
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                {headers.map((h) => (
                  <th key={h} className="px-2 py-2 text-left font-medium text-zinc-500">{h}</th>
                ))}
                <th className="sticky right-0 z-10 bg-zinc-50 px-2 py-2 text-right font-medium text-zinc-500 dark:bg-zinc-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-zinc-100 dark:border-zinc-800",
                    canEdit && "cursor-pointer active:bg-zinc-50 dark:active:bg-zinc-900/50"
                  )}
                  onClick={canEdit ? () => onEdit!(type!, row) : undefined}
                >
                  <td className="px-2 py-2 font-medium">{row.name}</td>
                  {type === "loan" ? (
                    <>
                      <td className="px-2 py-2 text-right">{formatCurrency(row.amount)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(row.outstanding ?? 0)}</td>
                      <td className="px-2 py-2 text-center">{row.pendingEmi}({row.emiDate}th)</td>
                      <td className="px-2 py-2 text-center">{row.emiDate}</td>
                      <td className="px-2 py-2 text-center">{row.interestRate}%</td>
                      <td className={cn("px-2 py-2 text-right font-medium", row.payable > 0 ? "text-red-600" : "text-emerald-600")}>
                        {formatCurrency(row.payable)}
                      </td>
                    </>
                  ) : type === "home" || type === "saving" || type === "insurance" ? (
                    <>
                      <td className="px-2 py-2 text-right">{formatCurrency(row.amount)}</td>
                      <td className={cn("px-2 py-2 text-right font-medium", row.payable > 0 ? "text-red-600" : "text-emerald-600")}>
                        {formatCurrency(row.payable)}
                      </td>
                    </>
                  ) : (
                    <td className="px-2 py-2 text-right">{formatCurrency(row.amount)}</td>
                  )}
                  <td className="px-2 py-2"><StatusBadge item={row} /></td>
                  <td
                    className="sticky right-0 z-10 bg-white px-2 py-2 dark:bg-zinc-950"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit!(type!, row)}
                          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onMarkPaid && type && (type === "loan" || type === "home" || type === "saving" || type === "insurance") && row.payable > 0 && (
                        <button
                          type="button"
                          onClick={() => onMarkPaid(type, row.id)}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] text-white"
                        >
                          Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlanPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<ExcelMonthlyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editContext, setEditContext] = useState<EditContext | null>(null);
  const [editingPlanIncome, setEditingPlanIncome] = useState(false);
  const [planIncomeDraft, setPlanIncomeDraft] = useState("");

  const load = () => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/plan?month=${month}&year=${year}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Failed to load plan");
        setData(d);
      })
      .catch((e) => {
        setLoadError(e instanceof Error ? e.message : "Failed to load plan");
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/plan?month=${month}&year=${year}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Failed to load plan");
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) {
          setLoadError(e instanceof Error ? e.message : "Failed to load plan");
          setData(null);
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
    setLoading(true);
    setMonth(m);
    setYear(y);
  };

  const markPaid = async (type: "loan" | "home" | "saving" | "insurance", id: string) => {
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_paid", type, id, month, year }),
    });
    load();
  };

  const saveEdit = async (type: PlanItemType, id: string, payload: Record<string, unknown>): Promise<boolean> => {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_item", type, id, data: payload, month, year }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to save changes");
      return false;
    }
    load();
    return true;
  };

  const savePlanIncome = async () => {
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_plan_income",
        planIncome: parseFloat(planIncomeDraft) || 0,
        month,
        year,
      }),
    });
    setEditingPlanIncome(false);
    load();
  };

  const resetTemplate = async () => {
    if (!confirm("Reset plan data from Excel template? This updates loans, expenses, income & savings.")) return;
    setLoading(true);
    await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_template", month, year }),
    });
    load();
  };

  const openEdit = (type: PlanItemType, item: ExcelPlanItem) => {
    setEditContext({ type, item });
  };

  const t = data?.totals;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader
        title="Monthly Plan"
        subtitle={data?.salaryCycle ?? "July-2026 Planned • Excel View"}
      />

      <PlanEditSheet
        context={editContext}
        onClose={() => setEditContext(null)}
        onSave={saveEdit}
      />

      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => shiftMonth(-1)} className="rounded-xl p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-lg font-bold">{data?.monthLabel}</p>
            <p className="text-xs text-zinc-500">Salary: {data?.salaryDay}th • Day {data?.currentDay}</p>
          </div>
          <button type="button" onClick={() => shiftMonth(1)} className="rounded-xl p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <Button variant="outline" className="w-full" onClick={resetTemplate}>
          <RefreshCw className="h-4 w-4" /> Load Excel Template Data
        </Button>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : loadError ? (
          <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
            <CardContent className="space-y-3 p-4 text-center">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{loadError}</p>
              <p className="text-xs text-zinc-500">
                If this persists, restart the dev server after running: npm run db:push
              </p>
              <Button variant="outline" onClick={load}>Try Again</Button>
            </CardContent>
          </Card>
        ) : data ? (
          <>
            <Card className="border-2 border-emerald-500">
              <CardContent className="grid grid-cols-3 gap-2 p-3 text-center text-xs">
                <div>
                  <p className="text-zinc-500">All Payable</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(t?.allPayable ?? 0)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Total Required</p>
                  <p className="text-lg font-bold">{formatCurrency(t?.totalRequired ?? 0)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Balance</p>
                  <p className={cn("text-lg font-bold", (t?.balance ?? 0) >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {formatCurrency(t?.balance ?? 0)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Income */}
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b bg-yellow-500 px-3 py-2">
                  {editingPlanIncome ? (
                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-sm text-white">Plan Income ₹</span>
                      <Input
                        type="number"
                        className="h-8 flex-1 text-sm"
                        value={planIncomeDraft}
                        onChange={(e) => setPlanIncomeDraft(e.target.value)}
                      />
                      <button type="button" onClick={savePlanIncome} className="rounded bg-white px-2 py-1 text-xs text-yellow-700">Save</button>
                      <button type="button" onClick={() => setEditingPlanIncome(false)} className="text-white text-xs">✕</button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-white">
                        Income — Plan: {formatCurrency(data.income.planTotal)}
                      </p>
                      <div className="flex items-center gap-2">
                        <Link href="/income" className="text-xs text-yellow-100 underline">Manage →</Link>
                        <button
                          type="button"
                          onClick={() => {
                            setPlanIncomeDraft(String(data.income.planTotal));
                            setEditingPlanIncome(true);
                          }}
                          className="rounded p-1 text-white hover:bg-yellow-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900">
                      <th className="px-2 py-2 text-left">Source</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.income.sources.map((inc) => (
                      <tr key={inc.id} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="px-2 py-2 font-medium">{inc.name}</td>
                        <td className="px-2 py-2 text-zinc-500">{inc.incomeType}</td>
                        <td className="px-2 py-2 text-right text-emerald-600">{formatCurrency(inc.amount)}</td>
                        <td className="px-2 py-2"><StatusBadge item={inc} /></td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => openEdit("income", inc)}
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-zinc-100 font-semibold dark:bg-zinc-800">
                      <td className="px-2 py-2" colSpan={2}>Sub Total (excl. Salary)</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(data.income.subTotalOther)}</td>
                      <td colSpan={2} />
                    </tr>
                    <tr className="border-t bg-emerald-50 font-bold dark:bg-emerald-950/30">
                      <td className="px-2 py-2" colSpan={2}>Total Income</td>
                      <td className="px-2 py-2 text-right text-emerald-700">{formatCurrency(data.income.breakdownTotal)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <PlanTable
              title={`Loan EMI — Total: ${formatCurrency(t?.loanEmi ?? 0)} | Payable: ${formatCurrency(t?.loanPayable ?? 0)} | OS: ${formatCurrency(t?.loanOutstanding ?? 0)}`}
              headers={["Particulars", "Amount", "Outstanding", "Pending", "EMI Date", "Rate", "Payable", "Status"]}
              rows={data.loans}
              onMarkPaid={markPaid}
              onEdit={openEdit}
              type="loan"
              manageHref="/loans"
            />

            <PlanTable
              title={`Fixed Home Expense — Total: ${formatCurrency(t?.homeTotal ?? 0)} | Payable: ${formatCurrency(t?.homePayable ?? 0)}`}
              headers={["Particulars", "Amount", "Payable", "Status"]}
              rows={data.homeExpenses}
              onMarkPaid={markPaid}
              onEdit={openEdit}
              type="home"
            />

            <PlanTable
              title={`Savings — Plan: ${formatCurrency(t?.savingsTotal ?? 0)} | Saved: ${formatCurrency(data.actualSavings?.total ?? 0)} | Payable: ${formatCurrency(t?.savingsPayable ?? 0)}`}
              headers={["Particulars", "Amount", "Payable", "Status"]}
              rows={data.savings}
              onMarkPaid={markPaid}
              onEdit={openEdit}
              type="saving"
              manageHref="/savings"
            />

            <Card>
              <CardContent className="p-0">
                <div className="border-b bg-orange-500 px-3 py-2">
                  <p className="text-sm font-semibold text-white">Before / After Salary ({data.salaryDay}th)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-900">
                        <th className="px-2 py-2 text-left" />
                        <th className="px-2 py-2 text-right">Loan</th>
                        <th className="px-2 py-2 text-right">Home</th>
                        <th className="px-2 py-2 text-right">Savings</th>
                        <th className="px-2 py-2 text-right">Fixed</th>
                        <th className="px-2 py-2 text-right">Subs</th>
                        <th className="px-2 py-2 text-right">Insurance</th>
                        <th className="px-2 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="px-2 py-2 font-medium">Before Salary</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.beforeSalary.loan ?? 0)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.beforeSalary.home ?? 0)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.beforeSalary.savings ?? 0)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.beforeSalary.fixed ?? 0)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.beforeSalary.subscriptions ?? 0)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.beforeSalary.insurance ?? 0)}</td>
                        <td className="px-2 py-2 text-right font-bold text-orange-600">{formatCurrency(t?.beforeSalary.total ?? 0)}</td>
                      </tr>
                      <tr className="border-t">
                        <td className="px-2 py-2 font-medium">After Salary</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.afterSalary.loan ?? 0)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.afterSalary.home ?? 0)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.afterSalary.savings ?? 0)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.afterSalary.fixed ?? 0)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.afterSalary.subscriptions ?? 0)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(t?.afterSalary.insurance ?? 0)}</td>
                        <td className="px-2 py-2 text-right font-bold">{formatCurrency(t?.afterSalary.total ?? 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <div className="border-b bg-teal-600 px-3 py-2">
                  <p className="text-sm font-semibold text-white">
                    Monthly Fixed Expenses — Total: {formatCurrency(t?.fixedTotal ?? 0)}
                  </p>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900">
                      <th className="px-2 py-2 text-left">Particulars</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthlyFixedExpenses.map((fe) => (
                      <tr key={fe.id} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="px-2 py-2 font-medium">{fe.name}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(fe.amount)}</td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => openEdit("monthly_fixed", fe)}
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-zinc-100 font-bold dark:bg-zinc-800">
                      <td className="px-2 py-2">Total</td>
                      <td className="px-2 py-2 text-right">
                        {formatCurrency(data.monthlyFixedExpenses.reduce((s, f) => s + f.amount, 0))}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <PlanTable
              title={`Subscriptions — Total: ${formatCurrency(t?.subscriptionTotal ?? 0)} | Payable: ${formatCurrency(t?.subscriptionPayable ?? 0)}`}
              headers={["Name", "Amount", "Status"]}
              rows={data.subscriptions}
              onEdit={openEdit}
              type="subscription"
              manageHref="/subscriptions"
            />

            <PlanTable
              title={`Insurance — Total: ${formatCurrency(t?.insuranceTotal ?? 0)}/mo | Payable: ${formatCurrency(t?.insurancePayable ?? 0)}`}
              headers={["Policy", "Monthly Premium", "Payable", "Status"]}
              rows={data.insurances}
              onMarkPaid={markPaid}
              onEdit={openEdit}
              type="insurance"
              manageHref="/insurance"
            />

            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b bg-rose-600 px-3 py-2">
                  <p className="text-sm font-semibold text-white">
                    Other Spend (Actual) — {formatCurrency(data.otherSpend.total)}
                  </p>
                  <Link href="/expenses" className="text-xs text-rose-100 underline">View all →</Link>
                </div>
                <div className="grid grid-cols-4 gap-1 border-b bg-zinc-50 p-2 text-center text-[10px] dark:bg-zinc-900">
                  <div><p className="text-zinc-500">Need</p><p className="font-semibold">{formatCurrency(data.otherSpend.need)}</p></div>
                  <div><p className="text-zinc-500">Want</p><p className="font-semibold">{formatCurrency(data.otherSpend.want)}</p></div>
                  <div><p className="text-zinc-500">Luxury</p><p className="font-semibold">{formatCurrency(data.otherSpend.luxury)}</p></div>
                  <div><p className="text-zinc-500">Savings</p><p className="font-semibold">{formatCurrency(data.otherSpend.savings)}</p></div>
                </div>
                {data.otherSpend.items.length > 0 ? (
                  <table className="w-full text-xs">
                    <tbody>
                      {data.otherSpend.items.slice(0, 8).map((exp) => (
                        <tr key={exp.id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="px-2 py-2 font-medium">{exp.name}</td>
                          <td className="px-2 py-2 text-zinc-500">{exp.category}</td>
                          <td className="px-2 py-2 text-right">{formatCurrency(exp.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-4 text-center text-xs text-zinc-500">No expenses logged this month yet.</p>
                )}
              </CardContent>
            </Card>

            {data.insights.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="mb-3 flex items-center gap-2 font-semibold">
                    <Sparkles className="h-4 w-4 text-indigo-600" /> Personal Advisor
                  </p>
                  <div className="space-y-2">
                    {data.insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
                        {INSIGHT_ICON[insight.type]}
                        <div>
                          <p className="text-sm font-medium">{insight.title}</p>
                          <p className="text-xs text-zinc-500">{insight.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-3">
                <p className="mb-2 text-xs font-medium text-zinc-500">Tap ✏️ on any row to edit amount, payable, or status</p>
                <div className="flex flex-wrap gap-2">
                  {["Paid", "Pending", "Due", "Overdue", "Closed"].map((s) => (
                    <span key={s} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] dark:bg-zinc-800">{s}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <BottomNav />
    </div>
  );
}
