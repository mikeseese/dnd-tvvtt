"use client";

import { useState, type JSX } from "react";
import { api } from "~/trpc/react";
import { useSessionSocket } from "~/lib/hooks/use-session-socket";
import { InitiativeTracker } from "~/app/_components/initiative-tracker";
import type { WsCharacterInfo } from "~/server/ws/types";

interface PlayerViewProps {
  token: string;
}

export function PlayerView({ token }: PlayerViewProps): JSX.Element {
  const { session, playerContext, isConnected } = useSessionSocket({
    role: "player",
    token,
  });

  const selectChar = api.player.selectCharacter.useMutation();
  const deselectChar = api.player.deselectCharacter.useMutation();
  const move = api.player.move.useMutation();

  const [pendingCharacter, setPendingCharacter] = useState<
    (WsCharacterInfo & { picked: boolean }) | null
  >(null);

  if (!session || !playerContext) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-app-bg)]">
        <p className="text-[var(--color-text-muted)]">
          {isConnected ? "Loading session..." : "Connecting..."}
        </p>
      </div>
    );
  }

  // Derive player-specific state
  const character = playerContext.character;
  const activeEncounter = session.activeEncounterId
    ? (session.encounters.find((e) => e.id === session.activeEncounterId) ??
      null)
    : null;
  const initiative = activeEncounter?.initiative ?? [];
  const currentTurn = activeEncounter?.currentTurn ?? 0;
  const activeMap =
    session.sessionMaps.find((sm) => sm.mapId === session.activeMapId)?.map ??
    null;

  // Determine turn and movement
  let isMyTurn = false;
  if (activeEncounter && playerContext.characterId && initiative.length > 0) {
    const currentEntry = initiative[currentTurn];
    isMyTurn = currentEntry?.characterId === playerContext.characterId;
  }
  const canMove = !activeEncounter || isMyTurn;

  // Find player's token on active map
  const myToken =
    playerContext.characterId && activeMap
      ? (session.tokens.find(
          (t) =>
            t.characterId === playerContext.characterId &&
            t.mapId === activeMap.id
        ) ?? null)
      : null;

  // Derive available characters for selection
  const pickedIds = new Set(
    session.deviceAuths
      .map((d) => d.characterId)
      .filter((id): id is string => id !== null)
  );
  const availableCharacters = session.characters.map((c) => ({
    ...c,
    picked: pickedIds.has(c.id),
  }));

  // Character Selection
  if (!character) {
    return (
      <div className="min-h-screen bg-[var(--color-app-bg)] p-4">
        <div className="mx-auto max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-accent)]">
              ⚔ Choose Your Character
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {session.campaignName}
            </p>
          </div>

          {/* Confirmation Dialog */}
          {pendingCharacter && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-xl">
                <h2 className="text-lg font-bold text-center mb-4">
                  Confirm Character
                </h2>
                <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 mb-4">
                  {pendingCharacter.avatarImageUrl ? (
                    <img
                      src={pendingCharacter.avatarImageUrl}
                      alt={pendingCharacter.fullName}
                      className="w-14 h-14 rounded-full object-cover border border-[var(--color-border)]"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[var(--color-surface-strong)] flex items-center justify-center text-lg font-bold">
                      {pendingCharacter.fullName[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">
                      {pendingCharacter.fullName}
                    </h3>
                    {pendingCharacter.nickname && (
                      <p className="text-xs text-[var(--color-text-subtle)]">
                        &ldquo;{pendingCharacter.nickname}&rdquo;
                      </p>
                    )}
                    <p className="text-sm text-[var(--color-text-muted)]">
                      Lv. {pendingCharacter.level} {pendingCharacter.race}{" "}
                      {pendingCharacter.characterClass}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-[var(--color-text-muted)] text-center mb-5">
                  Play as{" "}
                  <span className="font-semibold text-[var(--color-text)]">
                    {pendingCharacter.fullName}
                  </span>
                  ?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPendingCharacter(null)}
                    disabled={selectChar.isPending}
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--color-surface-strong)] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      selectChar.mutate(
                        { token, characterId: pendingCharacter.id },
                        { onSuccess: () => setPendingCharacter(null) }
                      );
                    }}
                    disabled={selectChar.isPending}
                    className="flex-1 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-bold text-[var(--color-text-on-accent)] transition hover:opacity-90 disabled:opacity-50"
                  >
                    {selectChar.isPending ? "Confirming..." : "Confirm"}
                  </button>
                </div>
                {selectChar.isError && (
                  <p className="mt-3 text-center text-xs text-[var(--color-danger)]">
                    {selectChar.error.message}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {availableCharacters.map((char) => (
              <button
                key={char.id}
                onClick={() => {
                  if (!char.picked) {
                    setPendingCharacter(char);
                  }
                }}
                disabled={char.picked || selectChar.isPending}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                  char.picked
                    ? "border-[var(--color-border)] bg-[var(--color-surface)] opacity-40 cursor-not-allowed"
                    : "border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-accent)] active:scale-[0.98]"
                }`}
              >
                {char.avatarImageUrl ? (
                  <img
                    src={char.avatarImageUrl}
                    alt={char.fullName}
                    className="w-14 h-14 rounded-full object-cover border border-[var(--color-border)]"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[var(--color-surface-strong)] flex items-center justify-center text-lg font-bold">
                    {char.fullName[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{char.fullName}</h3>
                  {char.nickname && (
                    <p className="text-xs text-[var(--color-text-subtle)]">
                      &ldquo;{char.nickname}&rdquo;
                    </p>
                  )}
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Lv. {char.level} {char.race} {char.characterClass}
                  </p>
                </div>
                <div className="text-right text-xs text-[var(--color-text-subtle)]">
                  {char.picked ? "Taken" : "Available"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Session View
  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] p-4 flex flex-col">
      {/* Connection indicator */}
      {!isConnected && (
        <div className="mb-2 rounded-lg bg-[var(--color-danger)]/20 px-3 py-1.5 text-center text-xs text-[var(--color-danger)]">
          Reconnecting...
        </div>
      )}

      {/* Character Info */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 mb-4">
        <div className="flex items-center gap-3">
          {character.avatarImageUrl ? (
            <img
              src={character.avatarImageUrl}
              alt={character.fullName}
              className="w-14 h-14 rounded-full object-cover border border-[var(--color-border)]"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[var(--color-surface-strong)] flex items-center justify-center text-lg font-bold">
              {character.fullName[0]}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-bold">{character.fullName}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Lv. {character.level} {character.race} {character.characterClass}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">
              <span
                className={
                  character.currentHp <= character.maxHp / 4
                    ? "text-[var(--color-danger)]"
                    : ""
                }
              >
                {character.currentHp}
              </span>
              /{character.maxHp} HP
            </p>
            <p className="text-xs text-[var(--color-text-subtle)]">
              AC {character.ac}
            </p>
          </div>
        </div>
        <button
          onClick={() => deselectChar.mutate({ token })}
          disabled={deselectChar.isPending}
          className="mt-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-strong)] hover:text-[var(--color-text)] disabled:opacity-50"
        >
          {deselectChar.isPending ? "Switching..." : "Switch Character"}
        </button>
        {deselectChar.isError && (
          <p className="mt-1.5 text-center text-xs text-[var(--color-danger)]">
            {deselectChar.error.message}
          </p>
        )}
      </div>

      {/* Session Status */}
      {session.status === "pending" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-pulse">⏳</div>
            <h2 className="text-xl font-bold mb-2">Waiting for the DM</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              The session hasn&apos;t started yet. Sit tight!
            </p>
          </div>
        </div>
      )}

      {session.status === "completed" && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">🏁</div>
            <h2 className="text-xl font-bold mb-2">Session Complete</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Great adventure! The session has ended.
            </p>
          </div>
        </div>
      )}

      {session.status === "active" && (
        <div className="flex flex-col flex-1 gap-4">
          {/* Encounter / Initiative Tracker */}
          {activeEncounter ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Encounter: {activeEncounter.name}
                </h3>
                <span className="rounded-full bg-[var(--color-danger)]/20 px-2 py-0.5 text-[0.6rem] font-medium text-[var(--color-danger)]">
                  In Combat
                </span>
              </div>
              <InitiativeTracker
                initiative={initiative}
                currentTurn={currentTurn}
                highlightCharacterId={playerContext.characterId}
                compact
              />
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
              <p className="text-xs text-[var(--color-text-muted)] text-center">
                No active encounter — free exploration
              </p>
            </div>
          )}

          {/* Movement Controls */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {canMove ? (
              <>
                <div className="text-center mb-6">
                  {activeEncounter ? (
                    <p className="text-xs uppercase tracking-wider text-[var(--color-accent)] font-bold mb-1">
                      Your Turn!
                    </p>
                  ) : (
                    <p className="text-xs uppercase tracking-wider text-[var(--color-success)] font-bold mb-1">
                      Free Movement
                    </p>
                  )}
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Use the controls below to move
                  </p>
                </div>

                {/* D-Pad */}
                <div className="grid grid-cols-3 grid-rows-3 gap-2 w-48 h-48">
                  <div /> {/* empty */}
                  <button
                    onClick={() => move.mutate({ token, direction: "up" })}
                    disabled={move.isPending}
                    className="rounded-xl bg-[var(--color-surface-strong)] border border-[var(--color-border)] text-2xl font-bold active:scale-95 active:bg-[var(--color-accent)] active:text-[var(--color-text-on-accent)] transition disabled:opacity-50 flex items-center justify-center"
                  >
                    ↑
                  </button>
                  <div /> {/* empty */}
                  <button
                    onClick={() => move.mutate({ token, direction: "left" })}
                    disabled={move.isPending}
                    className="rounded-xl bg-[var(--color-surface-strong)] border border-[var(--color-border)] text-2xl font-bold active:scale-95 active:bg-[var(--color-accent)] active:text-[var(--color-text-on-accent)] transition disabled:opacity-50 flex items-center justify-center"
                  >
                    ←
                  </button>
                  <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
                    <span className="text-xs text-[var(--color-text-subtle)]">
                      {myToken ? `${myToken.x},${myToken.y}` : "–"}
                    </span>
                  </div>
                  <button
                    onClick={() => move.mutate({ token, direction: "right" })}
                    disabled={move.isPending}
                    className="rounded-xl bg-[var(--color-surface-strong)] border border-[var(--color-border)] text-2xl font-bold active:scale-95 active:bg-[var(--color-accent)] active:text-[var(--color-text-on-accent)] transition disabled:opacity-50 flex items-center justify-center"
                  >
                    →
                  </button>
                  <div /> {/* empty */}
                  <button
                    onClick={() => move.mutate({ token, direction: "down" })}
                    disabled={move.isPending}
                    className="rounded-xl bg-[var(--color-surface-strong)] border border-[var(--color-border)] text-2xl font-bold active:scale-95 active:bg-[var(--color-accent)] active:text-[var(--color-text-on-accent)] transition disabled:opacity-50 flex items-center justify-center"
                  >
                    ↓
                  </button>
                  <div /> {/* empty */}
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="text-4xl mb-4">⏳</div>
                <p className="text-lg font-medium text-[var(--color-text-muted)]">
                  Waiting for your turn...
                </p>
                {initiative.length > 0 && initiative[currentTurn] && (
                  <p className="text-sm text-[var(--color-text-subtle)] mt-1">
                    Current turn:{" "}
                    <span className="text-[var(--color-accent)]">
                      {initiative[currentTurn]?.character.nickname ??
                        initiative[currentTurn]?.character.fullName}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
