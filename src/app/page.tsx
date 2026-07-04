import { BottomNav, AppHeader } from "@/components/layout/bottom-nav";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getDashboardData(session.userId);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 dark:bg-zinc-950">
      <AppHeader
        title={`Hello, ${session.name.split(" ")[0]}`}
        subtitle="Salary cycle: 7th – 6th • July 2026"
      />
      <DashboardView data={data as Parameters<typeof DashboardView>[0]["data"]} />
      <BottomNav />
    </div>
  );
}
