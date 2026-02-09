import Link from "next/link";
import type { JSX } from "react";

import { StudioManager } from "~/app/_components/studio";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { ThemeToggle } from "~/app/_components/theme-toggle";

export default async function Home(): Promise<JSX.Element> {
  const session = await auth();
  const displayName =
    session?.user?.name ??
    session?.user?.email ??
    session?.user?.id ??
    "Player";

  return (
    <HydrateClient>
      <main className="h-screen overflow-hidden bg-[var(--color-app-bg)] text-[var(--color-text-primary)]">
        <div className="relative mx-auto flex h-full w-full flex-col gap-6">
          <div className="pointer-events-none absolute inset-x-0 top-8 flex justify-center">
            <div className="h-56 w-56 rounded-full bg-[var(--color-glow)] blur-3xl" />
          </div>

          <div className="relative z-10 flex flex-1 overflow-hidden bg-[var(--color-panel)]">
            {session?.user ? (
              <div>logged in, todo!</div>
            ) : (
              <section className="flex flex-1 items-center justify-center px-10 text-center">
                <div className="max-w-md space-y-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--color-text-subtle)]">
                    Workspace locked
                  </p>
                  <h2 className="text-3xl font-semibold">
                    Access your studios instantly
                  </h2>
                  <p className="text-base text-[var(--color-text-muted)]">
                    Sign in to discover your games, manage developer tools, and
                    keep your keys aligned.
                  </p>
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    <Link
                      href="/api/auth/signin"
                      className="rounded-full px-8 py-3 text-sm font-semibold transition theme-btn-accent"
                    >
                      Sign in to continue
                    </Link>
                    <ThemeToggle />
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
