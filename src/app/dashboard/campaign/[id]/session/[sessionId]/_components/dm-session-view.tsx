"use client";

import { useState, useMemo, type JSX } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useSessionSocket } from "~/lib/hooks/use-session-socket";
import { MapDisplay } from "~/app/_components/map-display";
import { InitiativeTracker } from "~/app/_components/initiative-tracker";
import type { WsSessionState } from "~/server/ws/types";

type SessionData = RouterOutputs["gameSession"]["getById"];

interface DmSessionViewProps {
  initialData: SessionData;
  campaignId: string;
}

/** Convert the SSR tRPC response into a WsSessionState for the hook's
 *  initial state so the page renders instantly before the WS connects. */
function convertToWsState(data: SessionData): WsSessionState {
  return {
    id: data.id,
    name: data.name,
    shortCode: data.shortCode,
    status: data.status,
    campaignId: data.campaignId,
    campaignName: data.campaign.name,
    activeMapId: data.activeMapId,
    activeEncounterId: data.activeEncounterId,
    characters: data.campaign.characters,
    sessionMaps: data.sessionMaps,
    tokens: data.tokens as WsSessionState["tokens"],
    encounters: data.encounters as WsSessionState["encounters"],
    deviceAuths: data.deviceAuths.map((d) => ({
      id: d.id,
      characterId: d.characterId,
      character: d.character,
    })),
  };
}

export function DmSessionView({
  initialData,
  campaignId,
}: DmSessionViewProps): JSX.Element {
  const [placingCharId, setPlacingCharId] = useState<string | null>(null);
  const [initCharId, setInitCharId] = useState("");
  const [initRoll, setInitRoll] = useState(0);
  const [encounterName, setEncounterName] = useState("");
  const [confirmEndEncounter, setConfirmEndEncounter] = useState(false);

  const wsInitialState = useMemo(
    () => convertToWsState(initialData),
    [initialData]
  );

  const { session: data, isConnected } = useSessionSocket({
    role: "dm",
    sessionId: initialData.id,
    initialState: wsInitialState,
  });

  // ─── Mutations (still via tRPC, WS pushes deltas) ─────────

  const startSession = api.gameSession.start.useMutation();
  const endSession = api.gameSession.end.useMutation();
  const setActiveMap = api.gameSession.setActiveMap.useMutation();
  const startEncounter = api.gameSession.startEncounter.useMutation({
    onSuccess: () => setEncounterName(""),
  });
  const endEncounter = api.gameSession.endEncounter.useMutation();
  const addInitiative = api.gameSession.addToInitiative.useMutation({
    onSuccess: () => {
      setInitCharId("");
      setInitRoll(0);
    },
  });
  const removeInitiative = api.gameSession.removeFromInitiative.useMutation();
  const nextTurn = api.gameSession.nextTurn.useMutation();
  const prevTurn = api.gameSession.prevTurn.useMutation();
  const placeToken = api.gameSession.placeToken.useMutation({
    onSuccess: () => setPlacingCharId(null),
  });
  const removeToken = api.gameSession.removeToken.useMutation();

  // ─── Derived state ────────────────────────────────────────

  if (!data) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-[var(--color-text-muted)]">Loading session...</p>
      </div>
    );
  }

  const activeMap =
    data.sessionMaps.find((sm) => sm.mapId === data.activeMapId)?.map ??
    data.sessionMaps[0]?.map;
  const activeTokens = activeMap
    ? data.tokens.filter((t) => t.mapId === activeMap.id)
    : [];

  const activeEncounter = data.activeEncounterId
    ? (data.encounters.find((e) => e.id === data.activeEncounterId) ?? null)
    : null;
  const initiative = activeEncounter?.initiative ?? [];
  const currentTurn = activeEncounter?.currentTurn ?? 0;

  const currentTurnCharId =
    initiative.length > 0
      ? (initiative[currentTurn]?.characterId ?? null)
      : null;

  const charsNotInInitiative = activeEncounter
    ? data.characters.filter(
        (c) => !initiative.some((i) => i.characterId === c.id)
      )
    : data.characters;

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${data.shortCode}`
      : `/${data.shortCode}`;

  const displayUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/display/${data.shortCode}`
      : `/display/${data.shortCode}`;

  const handleMapClick = (gridX: number, gridY: number) => {
    if (!placingCharId || !activeMap) return;
    placeToken.mutate({
      sessionId: data.id,
      characterId: placingCharId,
      mapId: activeMap.id,
      x: gridX,
      y: gridY,
    });
  };

  return (
    <div>
      {/* Connection indicator */}
      {!isConnected && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger)]/20 px-3 py-1.5 text-center text-xs text-[var(--color-danger)]">
          WebSocket disconnected — reconnecting...
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/dashboard/campaign/${campaignId}`}
          className="text-sm text-[var(--color-text-subtle)] hover:text-[var(--color-text-primary)]"
        >
          ← Campaign
        </Link>
        <span className="text-[var(--color-text-subtle)]">/</span>
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <span
          className={`ml-2 rounded-full px-3 py-1 text-xs font-medium ${
            data.status === "active"
              ? "bg-[var(--color-success)]/20 text-[var(--color-success)]"
              : data.status === "completed"
                ? "bg-[var(--color-text-subtle)]/20 text-[var(--color-text-subtle)]"
                : "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
          }`}
        >
          {data.status}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left panel: Controls */}
        <div className="flex flex-col gap-4">
          {/* Session Controls */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
              Session Controls
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.status === "pending" && (
                <button
                  onClick={() => startSession.mutate({ id: data.id })}
                  className="rounded-lg px-4 py-2 text-sm font-semibold theme-btn-accent"
                >
                  Start Session
                </button>
              )}
              {data.status === "active" && (
                <button
                  onClick={() => endSession.mutate({ id: data.id })}
                  className="rounded-lg border border-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-[var(--color-danger)]"
                >
                  End Session
                </button>
              )}
            </div>
          </div>

          {/* QR Code / Join Info */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
              Player Join
            </h3>
            <div className="flex flex-col items-center gap-3">
              <QRCodeSVG
                value={joinUrl}
                size={140}
                bgColor="transparent"
                fgColor="var(--color-text-primary)"
                level="M"
              />
              <div className="text-center">
                <p className="text-2xl font-bold tracking-[0.2em] text-[var(--color-accent)]">
                  {data.shortCode}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-subtle)] break-all">
                  {joinUrl}
                </p>
              </div>
            </div>
            <div className="mt-3 border-t border-[var(--color-border)] pt-3">
              <p className="text-xs text-[var(--color-text-subtle)]">
                TV Display:
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-[var(--color-accent)] hover:underline break-all"
                >
                  {displayUrl}
                </a>
              </p>
            </div>
            {data.deviceAuths.length > 0 && (
              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <p className="text-xs font-medium text-[var(--color-text-subtle)] mb-1">
                  Connected Players ({data.deviceAuths.length})
                </p>
                {data.deviceAuths.map((da) => (
                  <p
                    key={da.id}
                    className="text-xs text-[var(--color-text-muted)]"
                  >
                    {da.character
                      ? da.character.fullName
                      : "Selecting character..."}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Map Selection */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
              Maps
            </h3>
            <div className="flex flex-col gap-1">
              {data.sessionMaps.map((sm) => (
                <button
                  key={sm.id}
                  onClick={() =>
                    setActiveMap.mutate({
                      sessionId: data.id,
                      mapId: sm.mapId,
                    })
                  }
                  className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                    sm.mapId === data.activeMapId
                      ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)] font-medium"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]"
                  }`}
                >
                  {sm.mapId === data.activeMapId ? "● " : "○ "}
                  {sm.map.name}
                </button>
              ))}
            </div>
          </div>

          {/* Encounter / Initiative */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
              Encounter
            </h3>

            {!activeEncounter ? (
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  No active encounter. Players can move freely.
                </p>
                <div className="flex gap-2 items-end">
                  <input
                    type="text"
                    value={encounterName}
                    onChange={(e) => setEncounterName(e.target.value)}
                    placeholder="Encounter name"
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => {
                      if (!encounterName.trim()) return;
                      startEncounter.mutate({
                        sessionId: data.id,
                        name: encounterName.trim(),
                      });
                    }}
                    disabled={!encounterName.trim()}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold theme-btn-accent disabled:opacity-50"
                  >
                    Start Encounter
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {activeEncounter.name}
                    </span>
                    <span className="rounded-full bg-[var(--color-success)]/20 px-2 py-0.5 text-[0.65rem] font-medium text-[var(--color-success)]">
                      active
                    </span>
                  </div>
                  <button
                    onClick={() => setConfirmEndEncounter(true)}
                    className="text-xs text-[var(--color-danger)] hover:underline"
                  >
                    End Encounter
                  </button>
                </div>

                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Initiative
                </h4>
                <InitiativeTracker
                  initiative={initiative}
                  currentTurn={currentTurn}
                  className="mb-3"
                />
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() =>
                      prevTurn.mutate({
                        sessionId: data.id,
                        encounterId: activeEncounter.id,
                      })
                    }
                    disabled={initiative.length === 0}
                    className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-30"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() =>
                      nextTurn.mutate({
                        sessionId: data.id,
                        encounterId: activeEncounter.id,
                      })
                    }
                    disabled={initiative.length === 0}
                    className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-30"
                  >
                    Next →
                  </button>
                </div>
                {charsNotInInitiative.length > 0 && (
                  <div className="border-t border-[var(--color-border)] pt-3">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <select
                          value={initCharId}
                          onChange={(e) => setInitCharId(e.target.value)}
                          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm"
                        >
                          <option value="">Select character</option>
                          {charsNotInInitiative.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="number"
                        value={initRoll}
                        onChange={(e) => setInitRoll(Number(e.target.value))}
                        placeholder="Roll"
                        className="w-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-center"
                      />
                      <button
                        onClick={() => {
                          if (!initCharId) return;
                          addInitiative.mutate({
                            sessionId: data.id,
                            encounterId: activeEncounter.id,
                            characterId: initCharId,
                            roll: initRoll,
                          });
                        }}
                        disabled={!initCharId}
                        className="rounded-lg px-3 py-1.5 text-sm font-semibold theme-btn-accent disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
                {initiative.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {initiative.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() =>
                          removeInitiative.mutate({
                            sessionId: data.id,
                            encounterId: activeEncounter.id,
                            characterId: entry.characterId,
                          })
                        }
                        className="text-[0.65rem] text-[var(--color-danger)] hover:underline"
                        title={`Remove ${entry.character.fullName}`}
                      >
                        ✕ {entry.character.nickname ?? entry.character.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Past encounters */}
            {data.encounters.filter((e) => e.status === "completed").length >
              0 && (
              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <p className="text-[0.65rem] font-medium text-[var(--color-text-subtle)] mb-1">
                  Past Encounters
                </p>
                {data.encounters
                  .filter((e) => e.status === "completed")
                  .map((e) => (
                    <p
                      key={e.id}
                      className="text-xs text-[var(--color-text-muted)]"
                    >
                      {e.name}
                    </p>
                  ))}
              </div>
            )}
          </div>

          {/* Token Placement */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
              Place Tokens
            </h3>
            <p className="text-xs text-[var(--color-text-subtle)] mb-2">
              Select a character, then click on the map to place their token.
            </p>
            <div className="flex flex-col gap-1">
              {data.characters.map((char) => {
                const hasToken = activeTokens.some(
                  (t) => t.characterId === char.id
                );
                return (
                  <div key={char.id} className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setPlacingCharId(
                          placingCharId === char.id ? null : char.id
                        )
                      }
                      className={`flex-1 rounded-lg px-3 py-1.5 text-left text-sm transition ${
                        placingCharId === char.id
                          ? "bg-[var(--color-accent)] text-[var(--color-text-on-accent)]"
                          : hasToken
                            ? "bg-[var(--color-surface-strong)] text-[var(--color-text-primary)]"
                            : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      {char.nickname ?? char.fullName}
                      {hasToken && " ✓"}
                    </button>
                    {hasToken && activeMap && (
                      <button
                        onClick={() =>
                          removeToken.mutate({
                            sessionId: data.id,
                            characterId: char.id,
                            mapId: activeMap.id,
                          })
                        }
                        className="text-xs text-[var(--color-danger)]"
                        title="Remove token"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {placingCharId && (
              <p className="mt-2 text-xs text-[var(--color-accent)] font-medium">
                Click on the map to place token →
              </p>
            )}
          </div>
        </div>

        {/* Right panel: Map view */}
        <div className="min-w-0">
          {activeMap ? (
            <MapDisplay
              map={activeMap}
              tokens={activeTokens}
              currentTurnCharacterId={currentTurnCharId}
              onClick={placingCharId ? handleMapClick : undefined}
              className="w-full"
            />
          ) : (
            <div className="flex items-center justify-center h-64 rounded-xl border border-dashed border-[var(--color-border)]">
              <p className="text-[var(--color-text-subtle)]">No map selected</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm End Encounter Modal */}
      {confirmEndEncounter && activeEncounter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-xl max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold mb-2">End Encounter?</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Are you sure you want to end{" "}
              <span className="font-medium text-[var(--color-text-primary)]">
                {activeEncounter.name}
              </span>
              ? Initiative will be cleared and players will be able to move
              freely.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmEndEncounter(false)}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  endEncounter.mutate({
                    sessionId: data.id,
                    encounterId: activeEncounter.id,
                  });
                  setConfirmEndEncounter(false);
                }}
                className="rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-white"
              >
                End Encounter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
