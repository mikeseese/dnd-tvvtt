"use client";

import { useEffect, useRef, useState } from "react";
import type {
  WsSessionState,
  WsPlayerContext,
  WsServerEvent,
} from "~/server/ws/types";

// ─── Config ─────────────────────────────────────────────────

type SessionSocketConfig =
  | { role: "player"; token: string }
  | { role: "dm"; sessionId: string; initialState?: WsSessionState }
  | { role: "display"; shortCode: string };

export interface SessionSocketResult {
  session: WsSessionState | null;
  playerContext: WsPlayerContext | null;
  isConnected: boolean;
}

// ─── Delta reducer ──────────────────────────────────────────

function applyDelta(
  state: WsSessionState,
  event: WsServerEvent
): WsSessionState {
  switch (event.type) {
    case "session:status-changed":
      return {
        ...state,
        status: event.data.status,
        ...(event.data.activeEncounterId !== undefined
          ? { activeEncounterId: event.data.activeEncounterId }
          : {}),
      };

    case "session:map-changed":
      return { ...state, activeMapId: event.data.activeMapId };

    case "session:token-moved":
      return {
        ...state,
        tokens: state.tokens.map((t) =>
          t.characterId === event.data.characterId &&
          t.mapId === event.data.mapId
            ? { ...t, x: event.data.x, y: event.data.y }
            : t
        ),
      };

    case "session:token-placed": {
      const idx = state.tokens.findIndex(
        (t) =>
          t.characterId === event.data.characterId &&
          t.mapId === event.data.mapId
      );
      if (idx >= 0) {
        return {
          ...state,
          tokens: state.tokens.map((t, i) => (i === idx ? event.data : t)),
        };
      }
      return { ...state, tokens: [...state.tokens, event.data] };
    }

    case "session:token-removed":
      return {
        ...state,
        tokens: state.tokens.filter(
          (t) =>
            !(
              t.characterId === event.data.characterId &&
              t.mapId === event.data.mapId
            )
        ),
      };

    case "session:encounter-started":
      return {
        ...state,
        encounters: [event.data, ...state.encounters],
        activeEncounterId: event.data.id,
      };

    case "session:encounter-ended":
      return {
        ...state,
        encounters: state.encounters.map((e) =>
          e.id === event.data.encounterId ? { ...e, status: "completed" } : e
        ),
        activeEncounterId: event.data.activeEncounterId,
      };

    case "session:initiative-updated":
      return {
        ...state,
        encounters: state.encounters.map((e) =>
          e.id === event.data.encounterId
            ? { ...e, initiative: event.data.initiative }
            : e
        ),
      };

    case "session:turn-changed":
      return {
        ...state,
        encounters: state.encounters.map((e) =>
          e.id === event.data.encounterId
            ? { ...e, currentTurn: event.data.currentTurn }
            : e
        ),
      };

    case "session:character-selected":
      return {
        ...state,
        deviceAuths: state.deviceAuths.map((d) =>
          d.id === event.data.deviceAuthId
            ? {
                ...d,
                characterId: event.data.characterId,
                character: event.data.character,
              }
            : d
        ),
      };

    case "session:character-deselected":
      return {
        ...state,
        deviceAuths: state.deviceAuths.map((d) =>
          d.id === event.data.deviceAuthId
            ? { ...d, characterId: null, character: null }
            : d
        ),
      };

    case "session:player-joined":
      return {
        ...state,
        deviceAuths: [...state.deviceAuths, event.data.deviceAuth],
      };

    default:
      return state;
  }
}

// ─── Hook ───────────────────────────────────────────────────

export function useSessionSocket(
  config: SessionSocketConfig
): SessionSocketResult {
  const [session, setSession] = useState<WsSessionState | null>(
    config.role === "dm" ? (config.initialState ?? null) : null
  );
  const [playerContext, setPlayerContext] = useState<WsPlayerContext | null>(
    null
  );
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const reconnectAttemptRef = useRef(0);

  // Extract stable primitive deps
  const role = config.role;
  const token = config.role === "player" ? config.token : undefined;
  const sessionId = config.role === "dm" ? config.sessionId : undefined;
  const shortCode = config.role === "display" ? config.shortCode : undefined;

  useEffect(() => {
    let disposed = false;

    const connect = () => {
      if (disposed) return;

      const params = new URLSearchParams();
      params.set("role", role);
      if (role === "player" && token) params.set("token", token);
      if (role === "dm" && sessionId) params.set("sessionId", sessionId);
      if (role === "display" && shortCode) params.set("shortCode", shortCode);

      const wsPort = process.env.NEXT_PUBLIC_WS_PORT ?? "3001";
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.hostname}:${wsPort}?${params.toString()}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (evt) => {
        if (disposed) return;
        const msg = JSON.parse(evt.data as string) as WsServerEvent;

        if (msg.type === "session:state") {
          const stateData = (
            msg as {
              type: "session:state";
              data: {
                session: WsSessionState;
                playerContext?: WsPlayerContext;
              };
            }
          ).data;
          setSession(stateData.session);
          if (stateData.playerContext) {
            setPlayerContext(stateData.playerContext);
          }
          return;
        }

        // Apply delta to session state
        setSession((prev) => (prev ? applyDelta(prev, msg) : prev));

        // Update player context when this player's character is selected
        if (msg.type === "session:character-selected") {
          const selData = (
            msg as {
              type: "session:character-selected";
              data: {
                deviceAuthId: string;
                characterId: string;
                character: WsPlayerContext["character"];
              };
            }
          ).data;
          setPlayerContext((prev) => {
            if (prev && prev.deviceAuthId === selData.deviceAuthId) {
              return {
                ...prev,
                characterId: selData.characterId,
                character: selData.character,
              };
            }
            return prev;
          });
        }

        // Update player context when this player's character is deselected
        if (msg.type === "session:character-deselected") {
          const deselData = (
            msg as {
              type: "session:character-deselected";
              data: { deviceAuthId: string };
            }
          ).data;
          setPlayerContext((prev) => {
            if (prev && prev.deviceAuthId === deselData.deviceAuthId) {
              return { ...prev, characterId: null, character: null };
            }
            return prev;
          });
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setIsConnected(false);
        wsRef.current = null;
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptRef.current),
          10000
        );
        reconnectAttemptRef.current++;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [role, token, sessionId, shortCode]);

  return { session, playerContext, isConnected };
}
