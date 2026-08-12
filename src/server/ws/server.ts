import { WebSocketServer } from "ws";
import { db } from "~/server/db";
import { Logger } from "~/server/logging";
import { sessionHub } from "./session-hub";
import type { WsClient } from "./session-hub";
import { sessionStateCache } from "./session-state-cache";
import type { WsSessionState, WsPlayerContext } from "./types";

async function loadSessionState(
  sessionId: string
): Promise<WsSessionState | null> {
  const session = await db.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      campaign: {
        include: { characters: true },
      },
      sessionMaps: {
        include: { map: true },
        orderBy: { sortOrder: "asc" },
      },
      tokens: {
        include: {
          character: {
            select: {
              id: true,
              fullName: true,
              nickname: true,
              avatarImageUrl: true,
              currentHp: true,
              maxHp: true,
              ac: true,
            },
          },
        },
      },
      encounters: {
        include: {
          initiative: {
            include: {
              character: {
                select: {
                  id: true,
                  fullName: true,
                  nickname: true,
                  avatarImageUrl: true,
                },
              },
            },
            orderBy: [{ roll: "desc" }, { sortOrder: "asc" }],
          },
        },
        orderBy: { createdAt: "desc" },
      },
      deviceAuths: {
        include: { character: true },
      },
    },
  });

  if (!session) return null;

  return {
    id: session.id,
    name: session.name,
    shortCode: session.shortCode,
    status: session.status,
    campaignId: session.campaignId,
    campaignName: session.campaign.name,
    activeMapId: session.activeMapId,
    activeEncounterId: session.activeEncounterId,
    characters: session.campaign.characters,
    sessionMaps: session.sessionMaps,
    tokens: sessionStateCache.overlayTokenPositions(
      session.id,
      session.tokens as WsSessionState["tokens"]
    ),
    encounters: session.encounters as WsSessionState["encounters"],
    deviceAuths: session.deviceAuths.map((d) => ({
      id: d.id,
      characterId: d.characterId,
      character: d.character,
    })),
  };
}

async function authenticatePlayer(
  token: string
): Promise<{ sessionId: string; playerContext: WsPlayerContext } | null> {
  const auth = await db.deviceAuth.findUnique({
    where: { token },
    include: { character: true },
  });
  if (!auth) return null;
  return {
    sessionId: auth.sessionId,
    playerContext: {
      deviceAuthId: auth.id,
      characterId: auth.characterId,
      character: auth.character,
    },
  };
}

async function resolveShortCode(shortCode: string): Promise<string | null> {
  const session = await db.gameSession.findUnique({
    where: { shortCode: shortCode.toUpperCase() },
    select: { id: true },
  });
  return session?.id ?? null;
}

export function startWsServer(): void {
  const globalForWs = globalThis as unknown as {
    __wsStarted: boolean | undefined;
  };
  if (globalForWs.__wsStarted) return;
  globalForWs.__wsStarted = true;

  const port = parseInt(process.env.WS_PORT ?? "3001", 10);
  const wss = new WebSocketServer({ port });

  // Start the session state cache (periodic DB flush)
  sessionStateCache.start();

  wss.on("connection", async (ws, req) => {
    let client: WsClient | null = null;

    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const role = url.searchParams.get("role") as
        | "dm"
        | "player"
        | "display"
        | null;

      if (!role || !["dm", "player", "display"].includes(role)) {
        ws.close(4001, "Invalid role");
        return;
      }

      let sessionId: string;
      let playerContext: WsPlayerContext | undefined;

      if (role === "player") {
        const token = url.searchParams.get("token");
        if (!token) {
          ws.close(4001, "Missing token");
          return;
        }
        const result = await authenticatePlayer(token);
        if (!result) {
          ws.close(4001, "Invalid token");
          return;
        }
        sessionId = result.sessionId;
        playerContext = result.playerContext;
      } else if (role === "dm") {
        sessionId = url.searchParams.get("sessionId") ?? "";
        if (!sessionId) {
          ws.close(4001, "Missing sessionId");
          return;
        }
        const exists = await db.gameSession.findUnique({
          where: { id: sessionId },
          select: { id: true },
        });
        if (!exists) {
          ws.close(4001, "Session not found");
          return;
        }
      } else {
        // display
        const shortCode = url.searchParams.get("shortCode");
        if (!shortCode) {
          ws.close(4001, "Missing shortCode");
          return;
        }
        const resolved = await resolveShortCode(shortCode);
        if (!resolved) {
          ws.close(4001, "Session not found");
          return;
        }
        sessionId = resolved;
      }

      client = {
        ws,
        role,
        sessionId,
        deviceAuthId: playerContext?.deviceAuthId,
        characterId: playerContext?.characterId,
      };

      sessionHub.addClient(client);

      // Load and send initial state snapshot
      const state = await loadSessionState(sessionId);
      if (!state) {
        ws.close(4001, "Failed to load session");
        return;
      }

      ws.send(
        JSON.stringify({
          type: "session:state",
          data: { session: state, playerContext },
        })
      );

      Logger.debug(
        `[WS] ${role} connected to session ${sessionId} (${sessionHub.getClientCount(sessionId)} clients)`
      );
    } catch (err) {
      Logger.error(`[WS] Connection error: ${err}`);
      ws.close(4000, "Internal error");
      return;
    }

    ws.on("close", () => {
      if (client) {
        sessionHub.removeClient(client);
        Logger.debug(
          `[WS] ${client.role} disconnected from session ${client.sessionId}`
        );
      }
    });

    ws.on("error", (err) => {
      Logger.error(`[WS] Socket error: ${err}`);
      if (client) {
        sessionHub.removeClient(client);
      }
    });
  });

  // Graceful shutdown: flush cache before exit
  const shutdown = async () => {
    Logger.info("[WS] Shutting down — flushing session state cache");
    await sessionStateCache.stop();
    wss.close();
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  Logger.info(`[WS] WebSocket server started on port ${port}`);
}
