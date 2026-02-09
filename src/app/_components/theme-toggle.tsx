"use client";

import type { JSX } from "react";

import { useTheme } from "~/app/_components/theme-provider";

export function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Activate ${isDark ? "light" : "dark"} mode`}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-strong)]"
    >
      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-text-muted)]">
        {isDark ? "Dark" : "Light"}
      </span>
      <span className="text-base">{isDark ? "☾" : "☀"}</span>
    </button>
  );
}
