"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarRange,
  Landmark,
  Repeat,
  User,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/plan", label: "Plan", icon: CalendarRange },
  { href: "/loans", label: "Loans", icon: Landmark },
  { href: "/subscriptions", label: "Subs", icon: Repeat },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      <Link
        href="/quick-add"
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition-transform hover:scale-105 active:scale-95"
        aria-label="Quick add expense"
      >
        <Plus className="h-7 w-7" />
      </Link>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 pb-safe">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/plan" && pathname === "/budget");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
                  active
                    ? "text-emerald-600"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur-lg dark:border-zinc-800 dark:bg-zinc-950/95">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {subtitle && (
        <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
      )}
    </header>
  );
}
