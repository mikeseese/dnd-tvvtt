"use client";

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

interface JoinHandlerProps {
  shortCode: string;
  sessionName: string;
  campaignName: string;
  sessionStatus: string;
}

export function JoinHandler({
  shortCode,
  sessionName,
  campaignName,
  sessionStatus,
}: JoinHandlerProps): JSX.Element {
  const [error, setError] = useState("");
  const router = useRouter();

  const joinMutation = api.player.join.useMutation({
    onSuccess: (data) => {
      router.push(`/play/session/${data.token}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleJoin = () => {
    setError("");
    joinMutation.mutate({ shortCode });
  };

  if (sessionStatus === "completed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg)] p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Session Ended</h1>
          <p className="text-[var(--color-text-muted)]">
            This session has already concluded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg)] p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold text-[var(--color-accent)] mb-2">
          ⚔ Forging VTT
        </h1>
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
            {campaignName}
          </p>
          <h2 className="text-xl font-bold mb-1">{sessionName}</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Code:{" "}
            <span className="font-mono font-bold text-[var(--color-accent)]">
              {shortCode}
            </span>
          </p>
          {error && (
            <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>
          )}
          <button
            onClick={handleJoin}
            disabled={joinMutation.isPending}
            className="w-full rounded-xl px-6 py-4 text-lg font-semibold transition theme-btn-accent disabled:opacity-50"
          >
            {joinMutation.isPending ? "Joining..." : "Join Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
