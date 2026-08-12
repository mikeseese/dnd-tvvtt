import config from "@incanta/config";
import { db } from "~/server/db";
import { Logger } from "~/server/logging";

/**
 * Cached token position — tracks the latest in-memory position
 * and whether it has been modified since last DB flush.
 */
interface CachedTokenPosition {
  tokenId: string;
  sessionId: string;
  characterId: string;
  mapId: string;
  x: number;
  y: number;
  dirty: boolean;
}

/**
 * Composite key for a token: sessionId + characterId + mapId
 */
const tokenKey = (
  sessionId: string,
  characterId: string,
  mapId: string
): string => `${sessionId}:${characterId}:${mapId}`;

class SessionStateCache {
  /**
   * In-memory token positions keyed by "sessionId:characterId:mapId".
   * Only tokens that have been moved at least once are tracked here.
   */
  private tokens = new Map<string, CachedTokenPosition>();

  /** Handle returned by setInterval for the periodic flush. */
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  /** Whether the cache has been started. */
  private started = false;

  /**
   * Start the periodic flush timer. Safe to call multiple times.
   */
  public start(): void {
    if (this.started) return;
    this.started = true;

    const intervalSeconds = config.get<number>(
      "server.cacheFlushIntervalSeconds"
    );

    Logger.info(
      `[Cache] Session state cache started (flush every ${intervalSeconds}s)`
    );

    this.flushTimer = setInterval(() => {
      void this.flushAll();
    }, intervalSeconds * 1000);

    // Don't hold the process open just for the flush timer
    if (
      this.flushTimer &&
      typeof this.flushTimer === "object" &&
      "unref" in this.flushTimer
    ) {
      this.flushTimer.unref();
    }
  }

  /**
   * Stop the periodic flush and do a final flush.
   */
  public async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.started = false;
    await this.flushAll();
  }

  // ─── Token position API ──────────────────────────────────────

  /**
   * Update a token's cached position. This does NOT write to the DB —
   * the periodic flush (or an explicit flushAll) handles that.
   */
  public updateTokenPosition(
    tokenId: string,
    sessionId: string,
    characterId: string,
    mapId: string,
    x: number,
    y: number
  ): void {
    const key = tokenKey(sessionId, characterId, mapId);
    this.tokens.set(key, {
      tokenId,
      sessionId,
      characterId,
      mapId,
      x,
      y,
      dirty: true,
    });
  }

  /**
   * Seed a token into the cache without marking it dirty.
   * Used when a token is freshly written to the DB (e.g. placeToken)
   * so that subsequent reads from the cache return the right value.
   */
  public seedTokenPosition(
    tokenId: string,
    sessionId: string,
    characterId: string,
    mapId: string,
    x: number,
    y: number
  ): void {
    const key = tokenKey(sessionId, characterId, mapId);
    this.tokens.set(key, {
      tokenId,
      sessionId,
      characterId,
      mapId,
      x,
      y,
      dirty: false,
    });
  }

  /**
   * Get the cached position for a token, or undefined if not cached.
   */
  public getTokenPosition(
    sessionId: string,
    characterId: string,
    mapId: string
  ): { x: number; y: number; tokenId: string } | undefined {
    const entry = this.tokens.get(tokenKey(sessionId, characterId, mapId));
    if (!entry) return undefined;
    return { x: entry.x, y: entry.y, tokenId: entry.tokenId };
  }

  /**
   * Remove a token from the cache (e.g. when a token is deleted).
   */
  public removeToken(
    sessionId: string,
    characterId: string,
    mapId: string
  ): void {
    this.tokens.delete(tokenKey(sessionId, characterId, mapId));
  }

  /**
   * Remove all cached tokens for a session (e.g. when last client disconnects).
   * Flushes dirty entries first.
   */
  public async clearSession(sessionId: string): Promise<void> {
    // Flush dirty tokens for this session first
    const toFlush: CachedTokenPosition[] = [];
    for (const [key, entry] of this.tokens) {
      if (entry.sessionId === sessionId) {
        if (entry.dirty) {
          toFlush.push(entry);
        }
        this.tokens.delete(key);
      }
    }
    if (toFlush.length > 0) {
      await this.flushEntries(toFlush);
    }
  }

  // ─── Overlay for loadSessionState ────────────────────────────

  /**
   * Given an array of tokens loaded from the DB, overlay any cached
   * (potentially newer) positions on top. Returns a new array.
   */
  public overlayTokenPositions<
    T extends { characterId: string; mapId: string; x: number; y: number },
  >(sessionId: string, tokens: T[]): T[] {
    return tokens.map((t) => {
      const cached = this.getTokenPosition(sessionId, t.characterId, t.mapId);
      if (cached) {
        return { ...t, x: cached.x, y: cached.y };
      }
      return t;
    });
  }

  // ─── Flush logic ─────────────────────────────────────────────

  /**
   * Persist all dirty cached token positions to the DB.
   */
  public async flushAll(): Promise<void> {
    const dirtyEntries: CachedTokenPosition[] = [];
    for (const entry of this.tokens.values()) {
      if (entry.dirty) {
        dirtyEntries.push(entry);
      }
    }

    if (dirtyEntries.length === 0) return;

    await this.flushEntries(dirtyEntries);
  }

  private async flushEntries(entries: CachedTokenPosition[]): Promise<void> {
    Logger.debug(
      `[Cache] Flushing ${entries.length} dirty token position(s) to DB`
    );

    // Use a transaction for atomicity
    try {
      await db.$transaction(
        entries.map((entry) =>
          db.playerToken.update({
            where: { id: entry.tokenId },
            data: { x: entry.x, y: entry.y },
          })
        )
      );

      // Mark entries as clean
      for (const entry of entries) {
        entry.dirty = false;
      }
    } catch (err) {
      Logger.error(`[Cache] Failed to flush token positions: ${err}`);
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────

const globalForCache = globalThis as unknown as {
  __sessionStateCache: SessionStateCache | undefined;
};

export const sessionStateCache =
  globalForCache.__sessionStateCache ?? new SessionStateCache();
globalForCache.__sessionStateCache = sessionStateCache;
