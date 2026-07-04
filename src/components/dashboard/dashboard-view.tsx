"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  PiggyBank,
  AlertCircle,
  Sparkles,
  Repeat,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { UsageTrendChart } from "@/components/dashboard/usage-trend-chart";

interface DashboardProps {
  data: {
    summary: {
      todayBalance: number;
      income: number;
      expenses: number;
      loans: number;
      savings: number;
      investments: number;
      cashInHand: number;
      bankBalance: number;
      remaining: number;
      todayExpenses: number;
      subscriptionTotal: number;
      budgetHealth: number;
      totalOutstanding: number;
    };
    upcomingEmi?: { name: string; emiAmount: number; emiDate: number } | null;
    expenseByClass: Record<string, number>;
    expenseByCategory: { name: string; value: number }[];
    goals: { name: string; targetAmount: number; currentAmount: number }[];
    notifications: { title: string; message: string; type?: string }[];
  };
}

export function DashboardView({ data }: DashboardProps) {
  const { summary } = data;

  return (
    <div className="space-y-4 p-4 pb-24">
      {/* Hero Balance */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-600 to-teal-700 text-white">
        <CardContent className="p-5">
          <p className="text-sm font-medium text-emerald-100">Today&apos;s Balance</p>
          <p className="mt-1 text-3xl font-bold">{formatCurrency(summary.todayBalance)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-emerald-100">Bank</p>
              <p className="font-semibold">{formatCurrency(summary.bankBalance)}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <p className="text-xs text-emerald-100">Cash in Hand</p>
              <p className="font-semibold">{formatCurrency(summary.cashInHand)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
          label="Income"
          value={formatCurrency(summary.income)}
          positive
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4 text-red-500" />}
          label="Expenses"
          value={formatCurrency(summary.expenses)}
        />
        <StatCard
          icon={<Landmark className="h-4 w-4 text-orange-500" />}
          label="Loan EMI"
          value={formatCurrency(summary.loans)}
        />
        <StatCard
          icon={<PiggyBank className="h-4 w-4 text-blue-500" />}
          label="Savings"
          value={formatCurrency(summary.savings)}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/plan">
          <Card className="transition-colors hover:border-indigo-300 dark:hover:border-indigo-700">
            <CardContent className="flex items-center gap-3 p-3">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              <div>
                <p className="text-sm font-medium">Monthly Plan</p>
                <p className="text-xs text-zinc-500">Planned vs Actual</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/subscriptions">
          <Card className="transition-colors hover:border-amber-300 dark:hover:border-amber-700">
            <CardContent className="flex items-center gap-3 p-3">
              <Repeat className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium">Subscriptions</p>
                <p className="text-xs text-zinc-500">{formatCurrency(summary.subscriptionTotal ?? 4450)}/mo</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Budget Health */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Budget Health</p>
              <p className="text-2xl font-bold text-emerald-600">{summary.budgetHealth}%</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-500">Remaining</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.remaining)}</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${summary.budgetHealth}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Upcoming EMI */}
      {data.upcomingEmi && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium">Upcoming EMI</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {data.upcomingEmi.name} — {formatCurrency(Number(data.upcomingEmi.emiAmount))} on{" "}
                {data.upcomingEmi.emiDate}
                {getDaySuffix(data.upcomingEmi.emiDate)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Trend by Classification */}
      <UsageTrendChart />

      {data.expenseByCategory.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 font-medium">Top Merchants</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data.expenseByCategory}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Goals */}
      {data.goals.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="font-medium">Goals</p>
            {data.goals.map((goal) => {
              const pct = Math.min(
                100,
                Math.round(
                  (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100
                )
              );
              return (
                <div key={goal.name}>
                  <div className="flex justify-between text-sm">
                    <span>{goal.name}</span>
                    <span className="text-zinc-500">{pct}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs text-zinc-500">{label}</span>
        </div>
        <p className={`mt-1 text-lg font-bold ${positive ? "text-emerald-600" : ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function getDaySuffix(day: number) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}
