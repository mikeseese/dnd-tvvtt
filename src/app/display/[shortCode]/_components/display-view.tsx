"use client";

import { type JSX } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSessionSocket } from "~/lib/hooks/use-session-socket";
import { MapDisplay } from "~/app/_components/map-display";
import { InitiativeTracker } from "~/app/_components/initiative-tracker";

interface DisplayViewProps {
  shortCode: string;
}

export function DisplayView({ shortCode }: DisplayViewProps): JSX.Element {
  const { session, isConnected } = useSessionSocket({
    role: "display",
    shortCode,
  });

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <p className="text-xl">
          {isConnected ? "Loading..." : "Connecting..."}
        </p>
      </div>
    );
  }

  const data = session;
  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/${shortCode}`
      : `/${shortCode}`;

  // Derive active map + tokens
  const activeMap =
    data.sessionMaps.find((sm) => sm.mapId === data.activeMapId)?.map ??
    data.sessionMaps[0]?.map ??
    null;
  const activeTokens = activeMap
    ? data.tokens.filter((t) => t.mapId === activeMap.id)
    : [];

  // Derive active encounter + initiative
  const activeEncounter = data.activeEncounterId
    ? (data.encounters.find((e) => e.id === data.activeEncounterId) ?? null)
    : null;
  const initiative = activeEncounter?.initiative ?? [];
  const currentTurn = activeEncounter?.currentTurn ?? 0;

  const currentTurnCharId =
    initiative.length > 0
      ? (initiative[currentTurn]?.characterId ?? null)
      : null;

  if (data.status === "pending") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black text-white">
        <h1 className="text-4xl font-bold text-[var(--color-accent)] mb-2">
          ⚔ Forging VTT
        </h1>
        <h2 className="text-2xl font-semibold mb-8">{data.name}</h2>
        <p className="text-lg text-gray-400 mb-6">Scan the QR code to join</p>
        <QRCodeSVG
          value={joinUrl}
          size={240}
          bgColor="transparent"
          fgColor="white"
          level="M"
        />
        <p className="mt-4 text-3xl font-bold tracking-[0.3em] text-[var(--color-accent)]">
          {shortCode}
        </p>
        <p className="mt-2 text-sm text-gray-500">{joinUrl}</p>
      </div>
    );
  }

  if (data.status === "completed") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black text-white">
        <h1 className="text-4xl font-bold mb-4">🏁 Session Complete</h1>
        <p className="text-lg text-gray-400">{data.name}</p>
      </div>
    );
  }

  // Active session - show map
  return (
    <div className="flex h-screen flex-col bg-black text-white overflow-hidden">
      {/* Map area - fills most of screen */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        {activeMap ? (
          <MapDisplay
            map={activeMap}
            tokens={activeTokens}
            currentTurnCharacterId={currentTurnCharId}
            className="max-h-full max-w-full"
          />
        ) : (
          <p className="text-gray-400">No active map</p>
        )}
      </div>

      {/* Bottom bar - encounter info + initiative + QR */}
      <div className="flex items-center gap-4 border-t border-gray-800 bg-gray-950 px-4 py-2">
        <div className="flex-1 min-w-0">
          {activeEncounter ? (
            <div>
              <p className="text-[0.6rem] uppercase tracking-wider text-gray-500 mb-1">
                Encounter: {activeEncounter.name}
              </p>
              <InitiativeTracker
                initiative={initiative}
                currentTurn={currentTurn}
                compact
              />
            </div>
          ) : (
            <p className="text-sm text-gray-500">No active encounter</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <QRCodeSVG
            value={joinUrl}
            size={48}
            bgColor="transparent"
            fgColor="white"
            level="L"
          />
          <div className="text-right">
            <p className="text-sm font-bold tracking-[0.15em] text-[var(--color-accent)]">
              {shortCode}
            </p>
            <p className="text-[0.6rem] text-gray-500">{data.campaignName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
