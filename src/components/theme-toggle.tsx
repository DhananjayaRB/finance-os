"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = true }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (!mounted) {
    return (
      <div className={cn("flex items-center justify-between", className)}>
        {showLabel && (
          <div className="flex items-center gap-3">
            <Sun className="h-5 w-5 text-zinc-400" />
            <span>Appearance</span>
          </div>
        )}
        <div className="h-7 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {showLabel && (
        <div className="flex items-center gap-3">
          {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          <div>
            <span className="font-medium">{isDark ? "Dark Mode" : "Light Mode"}</span>
            <p className="text-xs text-zinc-500">{isDark ? "Tap for light" : "Tap for dark"}</p>
          </div>
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={toggle}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          isDark ? "bg-emerald-600" : "bg-zinc-300 dark:bg-zinc-600"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            isDark ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
