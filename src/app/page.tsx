import Link from "next/link";
import type { JSX } from "react";

import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { ThemeToggle } from "~/app/_components/theme-toggle";

export default async function Home(): Promise<JSX.Element> {
  const session = await auth();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-app-bg)] text-[var(--color-text-primary)] p-4">
        <div className="pointer-events-none absolute inset-x-0 top-8 flex justify-center">
          <div className="h-56 w-56 rounded-full bg-[var(--color-glow)] blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-md text-center">
          <h1 className="text-5xl font-bold text-[var(--color-accent)] mb-2">⚔ Forging VTT</h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-10">
            A virtual table top for in-person TTRPG sessions
          </p>

          <div className="flex flex-col gap-4">
            {session?.user ? (
              <Link
                href="/dashboard"
                className="rounded-xl px-8 py-4 text-lg font-semibold transition theme-btn-accent"
              >
                Open Dashboard
              </Link>
            ) : (
              <Link
                href="/api/auth/signin"
                className="rounded-xl px-8 py-4 text-lg font-semibold transition theme-btn-accent"
              >
                Sign in as DM
              </Link>
            )}

            <Link
              href="/play"
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-4 text-lg font-semibold transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-strong)]"
            >
              Join as Player
            </Link>
          </div>

          <div className="mt-8">
            <ThemeToggle />
          </div>

          {session?.user && (
            <p className="mt-4 text-xs text-[var(--color-text-subtle)]">
              Signed in as {session.user.name ?? session.user.email}
            </p>
          )}
        </div>
      </main>
    </HydrateClient>
  );
}