"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface NotificationItem {
  title: string;
  message: string;
  type: string;
  category?: string;
}

const TYPE_STYLE: Record<string, string> = {
  CRITICAL: "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
  WARNING: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
  INFO: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20",
  SUCCESS: "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications || []));
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Notifications" subtitle="Pending, due, overdue & plan alerts" />
      <div className="space-y-3 p-4">
        <p className="text-xs text-zinc-500">
          Alerts from your <Link href="/plan" className="underline">Monthly Plan</Link> — EMI, expenses, savings, subscriptions, insurance.
        </p>
        {notifications.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No alerts right now. All caught up!</p>
        ) : (
          notifications.map((n, i) => (
            <Card
              key={i}
              className={cn(
                "border",
                TYPE_STYLE[n.type] || TYPE_STYLE.INFO
              )}
            >
              <CardContent className="p-4">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase dark:bg-black/20">
                    {n.type}
                  </span>
                  {n.category && (
                    <span className="text-[10px] text-zinc-500">{n.category}</span>
                  )}
                </div>
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{n.message}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
}
