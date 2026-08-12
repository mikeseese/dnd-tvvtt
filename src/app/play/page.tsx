"use client";

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";

export default function PlayPage(): JSX.Element {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (cleaned.length !== 6) {
      setError("Please enter a valid 6-character code");
      return;
    }
    setError("");
    router.push(`/${cleaned}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg)] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--color-accent)]">
            ⚔ Forging VTT
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Enter the session code from your DM
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError("");
            }}
            maxLength={6}
            placeholder="ABC123"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 text-center text-2xl font-bold tracking-[0.3em] uppercase placeholder:text-[var(--color-text-subtle)] placeholder:tracking-[0.3em]"
            autoFocus
          />
          {error && (
            <p className="text-sm text-[var(--color-danger)] text-center">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={code.trim().length !== 6}
            className="rounded-xl px-6 py-4 text-lg font-semibold transition theme-btn-accent disabled:opacity-50"
          >
            Join Session
          </button>
        </form>
      </div>
    </div>
  );
}
