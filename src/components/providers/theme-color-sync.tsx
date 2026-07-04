"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/** Keeps mobile browser chrome (theme-color) in sync with light/dark mode. */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const isDark = resolvedTheme === "dark";
    const color = isDark ? "#09090b" : "#fafafa";

    document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
      el.setAttribute("content", color);
    });

    const appleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleStatus) {
      appleStatus.setAttribute("content", isDark ? "black-translucent" : "default");
    }
  }, [resolvedTheme]);

  return null;
}
