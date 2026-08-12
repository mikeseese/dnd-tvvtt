import Link from "next/link";
import { redirect } from "next/navigation";
import type { JSX } from "react";

import { auth } from "~/server/auth";
import { ThemeToggle } from "~/app/_components/theme-toggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] text-[var(--color-text-primary)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-panel)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-lg font-bold text-[var(--color-accent)]"
            >
              ⚔ Forging VTT
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/dashboard"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Campaigns
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--color-text-subtle)]">
              {session.user.name ?? session.user.email}
            </span>
            <ThemeToggle />
            <Link
              href="/api/auth/signout"
              className="text-sm text-[var(--color-text-subtle)] hover:text-[var(--color-danger)] transition-colors"
            >
              Sign out
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
