import type { WsServerEvent } from "./types";
import { sessionStateCache } from "./session-state-cache";

export interface WsClient {
  ws: { readyState: number; send: (data: string) => void };
  role: "dm" | "player" | "display";
  sessionId: string;
  deviceAuthId?: string;
  characterId?: string | null;
}

class SessionHub {
  private sessions = new Map<string, Set<WsClient>>();

  addClient(client: WsClient): void {
    let clients = this.sessions.get(client.sessionId);
    if (!clients) {
      clients = new Set();
      this.sessions.set(client.sessionId, clients);
    }
    clients.add(client);
  }

  removeClient(client: WsClient): void {
    const clients = this.sessions.get(client.sessionId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.sessions.delete(client.sessionId);
        // Flush & clear cached state when last client leaves
        void sessionStateCache.clearSession(client.sessionId);
      }
    }
  }

  broadcast(sessionId: string, event: WsServerEvent): void {
    const clients = this.sessions.get(sessionId);
    if (!clients) return;
    const message = JSON.stringify(event);
    for (const client of clients) {
      if (client.ws.readyState === 1) {
        // WebSocket.OPEN
        client.ws.send(message);
      }
    }
  }

  getClientCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.size ?? 0;
  }
}

const globalForHub = globalThis as unknown as {
  __sessionHub: SessionHub | undefined;
};

export const sessionHub = globalForHub.__sessionHub ?? new SessionHub();
globalForHub.__sessionHub = sessionHub;
