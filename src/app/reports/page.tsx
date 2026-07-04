"use client";

import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Reports" subtitle="Daily • Weekly • Monthly • Yearly" />
      <div className="space-y-3 p-4">
        {["Daily", "Weekly", "Monthly", "Yearly"].map((period) => (
          <Card key={period}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">{period} Report</p>
                <p className="text-sm text-zinc-500">Expense, income, savings charts</p>
              </div>
              <span className="text-emerald-600 text-sm">View →</span>
            </CardContent>
          </Card>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}
