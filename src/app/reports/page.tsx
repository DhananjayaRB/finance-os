"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import type { UsageTrendData, UsageTrendPeriod } from "@/lib/usage-trend";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type ReportTab = "daily" | "weekly" | "monthly" | "yearly";

const TABS: { id: ReportTab; label: string; period: UsageTrendPeriod }[] = [
  { id: "daily", label: "Daily", period: "this_month" },
  { id: "weekly", label: "Weekly", period: "last_7_days" },
  { id: "monthly", label: "Monthly", period: "last_6_months" },
  { id: "yearly", label: "Yearly", period: "this_year" },
];

const CLASS_META = [
  { key: "NEED" as const, label: "Need", color: "#10b981" },
  { key: "WANT" as const, label: "Want", color: "#f59e0b" },
  { key: "LUXURY" as const, label: "Luxury", color: "#ef4444" },
];

function shortRupee(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>("daily");
  const [data, setData] = useState<UsageTrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const active = TABS.find((t) => t.id === tab)!;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/dashboard/usage-trend?period=${active.period}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Failed to load report");
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) {
          setError(e instanceof Error ? e.message : "Failed to load report");
          setData(null);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [active.period]);

  const consolidated = data?.consolidated;
  const pieData = useMemo(() => {
    if (!consolidated) return [];
    return CLASS_META.map((c) => ({
      name: c.label,
      value: consolidated[c.key],
      color: c.color,
    })).filter((d) => d.value > 0);
  }, [consolidated]);

  const showDailyBars = tab === "daily" || tab === "weekly";

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Reports" subtitle="Expense breakdown by period" />

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg py-2 text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-800 dark:text-emerald-400"
                  : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : error ? (
          <Card className="border-red-200 dark:border-red-900">
            <CardContent className="p-4 text-center text-sm text-red-600">{error}</CardContent>
          </Card>
        ) : data ? (
          <>
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{active.label} Report</p>
                    <p className="text-xs text-zinc-500">{data.periodLabel}</p>
                  </div>
                  <p className="text-lg font-bold text-red-600">
                    {formatCurrency(consolidated?.total ?? 0)}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {CLASS_META.map((c) => (
                    <div
                      key={c.key}
                      className="rounded-xl bg-zinc-50 p-2 dark:bg-zinc-900"
                    >
                      <p className="text-[10px] text-zinc-500">{c.label}</p>
                      <p className="text-sm font-semibold" style={{ color: c.color }}>
                        {formatCurrency(consolidated?.[c.key] ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {(data.points?.length ?? 0) > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="mb-3 text-sm font-medium">
                    {showDailyBars ? "Spend by day" : "Spend by month"}
                  </p>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.points}>
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => shortRupee(Number(v))}
                          width={42}
                        />
                        <Tooltip
                          formatter={(value) => formatCurrency(Number(value) || 0)}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar dataKey="NEED" stackId="a" fill="#10b981" name="Need" />
                        <Bar dataKey="WANT" stackId="a" fill="#f59e0b" name="Want" />
                        <Bar
                          dataKey="LUXURY"
                          stackId="a"
                          fill="#ef4444"
                          name="Luxury"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {pieData.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="mb-3 text-sm font-medium">Need / Want / Luxury split</p>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {pieData.map((d) => (
                            <Cell key={d.name} fill={d.color} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip
                          formatter={(value) => formatCurrency(Number(value) || 0)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {(consolidated?.total ?? 0) === 0 && (
              <p className="py-8 text-center text-sm text-zinc-500">
                No expenses in this period yet.
              </p>
            )}
          </>
        ) : null}
      </div>

      <BottomNav />
    </div>
  );
}
