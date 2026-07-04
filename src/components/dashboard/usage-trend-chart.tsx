"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import type { UsageTrendData, UsageTrendPeriod } from "@/lib/usage-trend";
import {
  AreaChart,
  Area,
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

const PERIODS: { value: UsageTrendPeriod; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "salary_cycle", label: "Salary Cycle" },
  { value: "last_3_months", label: "3 Months" },
  { value: "last_6_months", label: "6 Months" },
  { value: "this_year", label: "This Year" },
  { value: "all", label: "All" },
];

const CLASS_META = [
  { key: "NEED", label: "Need", color: "#10b981" },
  { key: "WANT", label: "Want", color: "#f59e0b" },
  { key: "LUXURY", label: "Luxury", color: "#ef4444" },
  { key: "SAVINGS", label: "Save", color: "#3b82f6" },
] as const;

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function UsageTrendChart() {
  const [period, setPeriod] = useState<UsageTrendPeriod>("this_month");
  const [data, setData] = useState<UsageTrendData | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/dashboard/usage-trend?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setData(d);
      });
    return () => {
      active = false;
    };
  }, [period]);

  const loading = !data || data.period !== period;

  const consolidated = data?.consolidated;
  const pieData = consolidated
    ? CLASS_META.map((c) => ({
        name: c.label,
        key: c.key,
        value: consolidated[c.key],
        color: c.color,
      })).filter((d) => d.value > 0)
    : [];

  const showDaily = period === "this_month" || period === "salary_cycle";
  const chartHeight = showDaily ? 200 : 220;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">Usage Trend</p>
            <p className="text-xs text-zinc-500">{data?.periodLabel ?? "Loading..."}</p>
          </div>
          {consolidated && consolidated.total > 0 && (
            <p className="text-right text-sm font-semibold text-emerald-600">
              {formatCurrency(consolidated.total)}
            </p>
          )}
        </div>

        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                period === p.value
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : !consolidated || consolidated.total === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">No expenses in this period</p>
        ) : data.isConsolidated ? (
          <ConsolidatedView pieData={pieData} consolidated={consolidated} />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={chartHeight}>
              {showDaily && data.points.length > 1 ? (
                <AreaChart data={data.points}>
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  {CLASS_META.map((c) => (
                    <Area
                      key={c.key}
                      type="monotone"
                      dataKey={c.key}
                      stackId="1"
                      stroke={c.color}
                      fill={c.color}
                      fillOpacity={0.6}
                      name={c.label}
                    />
                  ))}
                </AreaChart>
              ) : (
                <BarChart data={data.points}>
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  {CLASS_META.map((c) => (
                    <Bar key={c.key} dataKey={c.key} stackId="a" fill={c.color} name={c.label} radius={c.key === "SAVINGS" ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>

            <ClassBreakdown consolidated={consolidated} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConsolidatedView({
  pieData,
  consolidated,
}: {
  pieData: { name: string; key: string; value: number; color: string }[];
  consolidated: UsageTrendData["consolidated"];
}) {
  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
          >
            {pieData.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
      <ClassBreakdown consolidated={consolidated} />
    </>
  );
}

function ClassBreakdown({ consolidated }: { consolidated: UsageTrendData["consolidated"] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {CLASS_META.map((c) => {
        const amount = consolidated[c.key];
        const share = pct(amount, consolidated.total);
        return (
          <div
            key={c.key}
            className="rounded-xl border border-zinc-200 p-2.5 dark:border-zinc-800"
          >
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              <span className="text-xs font-medium text-zinc-500">{c.label}</span>
            </div>
            <p className="mt-1 text-sm font-bold">{formatCurrency(amount)}</p>
            <p className="text-[10px] text-zinc-400">{share}% of total</p>
          </div>
        );
      })}
    </div>
  );
}
