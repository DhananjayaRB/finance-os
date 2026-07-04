"use client";

import { useEffect, useState } from "react";
import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<
    { title: string; message: string; type: string }[]
  >([]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications || []));
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 pb-24 dark:bg-zinc-950">
      <AppHeader title="Notifications" subtitle="EMI, SIP & budget alerts" />
      <div className="space-y-3 p-4">
        {notifications.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No new notifications</p>
        ) : (
          notifications.map((n, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-zinc-500">{n.message}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
}
