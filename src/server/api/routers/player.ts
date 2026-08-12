import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { generateDeviceToken } from "~/lib/utils";
import { sessionHub } from "~/server/ws/session-hub";
import { sessionStateCache } from "~/server/ws/session-state-cache";

export const playerRouter = createTRPCRouter({
  join: publicProcedure
    .input(z.object({ shortCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findUnique({
        where: { shortCode: input.shortCode.toUpperCase() },
      });
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }
      if (session.status === "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session has ended",
        });
      }

      const token = generateDeviceToken();
      await ctx.db.deviceAuth.create({
        data: {
          token,
          sessionId: session.id,
        },
      });

      // Look up the created device auth to get the ID for broadcasting
      const deviceAuth = await ctx.db.deviceAuth.findUnique({
        where: { token },
      });
      if (deviceAuth) {
        sessionHub.broadcast(session.id, {
          type: "session:player-joined",
          data: {
            deviceAuth: {
              id: deviceAuth.id,
              characterId: null,
              character: null,
            },
          },
        });
      }

      return { token, sessionId: session.id };
    }),

  getState: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const auth = await ctx.db.deviceAuth.findUnique({
        where: { token: input.token },
        include: {
          session: {
            include: {
              campaign: { select: { name: true } },
              sessionMaps: {
                include: { map: true },
                orderBy: { sortOrder: "asc" },
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
              tokens: true,
            },
          },
          character: true,
        },
      });

      if (!auth) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid device token",
        });
      }

      const { session } = auth;
      const activeMap =
        session.sessionMaps.find((sm) => sm.mapId === session.activeMapId)
          ?.map ?? null;

      // Find active encounter
      const activeEncounter = session.activeEncounterId
        ? (session.encounters.find((e) => e.id === session.activeEncounterId) ??
          null)
        : null;

      const initiative = activeEncounter?.initiative ?? [];
      const currentTurn = activeEncounter?.currentTurn ?? 0;

      // Determine if it's this player's turn (only relevant during an encounter)
      let isMyTurn = false;
      if (activeEncounter && auth.characterId && initiative.length > 0) {
        const currentEntry = initiative[currentTurn];
        isMyTurn = currentEntry?.characterId === auth.characterId;
      }

      // Players can always move when there's no active encounter
      const canMove = !activeEncounter || isMyTurn;

      // Get this player's token position on the active map (prefer cache)
      let myToken = null;
      if (auth.characterId && activeMap) {
        const cachedPos = sessionStateCache.getTokenPosition(
          session.id,
          auth.characterId,
          activeMap.id
        );
        const dbToken =
          session.tokens.find(
            (t) =>
              t.characterId === auth.characterId && t.mapId === activeMap.id
          ) ?? null;
        if (cachedPos) {
          myToken = dbToken
            ? { ...dbToken, x: cachedPos.x, y: cachedPos.y }
            : { id: cachedPos.tokenId, x: cachedPos.x, y: cachedPos.y };
        } else {
          myToken = dbToken;
        }
      }

      return {
        sessionId: session.id,
        sessionName: session.name,
        campaignName: session.campaign.name,
        status: session.status,
        shortCode: session.shortCode,
        character: auth.character,
        isMyTurn,
        canMove,
        myToken,
        activeMap,
        activeEncounter: activeEncounter
          ? {
              id: activeEncounter.id,
              name: activeEncounter.name,
              status: activeEncounter.status,
            }
          : null,
        initiative,
        currentTurn,
      };
    }),

  getAvailableCharacters: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const auth = await ctx.db.deviceAuth.findUnique({
        where: { token: input.token },
        include: {
          session: {
            include: {
              campaign: {
                include: { characters: true },
              },
              deviceAuths: {
                select: { characterId: true },
              },
            },
          },
        },
      });

      if (!auth) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid device token",
        });
      }

      const pickedIds = new Set(
        auth.session.deviceAuths
          .map((d) => d.characterId)
          .filter((id): id is string => id !== null)
      );

      return auth.session.campaign.characters.map((c) => ({
        ...c,
        picked: pickedIds.has(c.id),
      }));
    }),

  selectCharacter: publicProcedure
    .input(
      z.object({
        token: z.string(),
        characterId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const auth = await ctx.db.deviceAuth.findUnique({
        where: { token: input.token },
        include: {
          session: {
            include: {
              deviceAuths: { select: { characterId: true, id: true } },
            },
          },
        },
      });

      if (!auth) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid device token",
        });
      }

      // Check if character is already picked by someone else
      const alreadyPicked = auth.session.deviceAuths.some(
        (d) => d.characterId === input.characterId && d.id !== auth.id
      );
      if (alreadyPicked) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Character already picked by another player",
        });
      }

      return ctx.db.deviceAuth
        .update({
          where: { token: input.token },
          data: { characterId: input.characterId },
          include: { character: true },
        })
        .then((result) => {
          if (result.character) {
            sessionHub.broadcast(auth.sessionId, {
              type: "session:character-selected",
              data: {
                deviceAuthId: auth.id,
                characterId: input.characterId,
                character: result.character,
              },
            });
          }
          return result;
        });
    }),

  deselectCharacter: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const auth = await ctx.db.deviceAuth.findUnique({
        where: { token: input.token },
        include: {
          session: {
            include: {
              encounters: {
                where: { status: "active" },
                include: {
                  initiative: true,
                },
              },
            },
          },
        },
      });

      if (!auth) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid device token",
        });
      }

      if (!auth.characterId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No character selected",
        });
      }

      // Don't allow switching during an active encounter if the character is in initiative
      const activeEncounter = auth.session.encounters[0] ?? null;
      if (activeEncounter) {
        const inInitiative = activeEncounter.initiative.some(
          (e) => e.characterId === auth.characterId
        );
        if (inInitiative) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot switch characters while in an active encounter",
          });
        }
      }

      await ctx.db.deviceAuth.update({
        where: { token: input.token },
        data: { characterId: null },
      });

      sessionHub.broadcast(auth.sessionId, {
        type: "session:character-deselected",
        data: { deviceAuthId: auth.id },
      });

      return { success: true };
    }),

  move: publicProcedure
    .input(
      z.object({
        token: z.string(),
        direction: z.enum(["up", "down", "left", "right"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const auth = await ctx.db.deviceAuth.findUnique({
        where: { token: input.token },
        include: {
          session: {
            include: {
              encounters: {
                include: {
                  initiative: {
                    orderBy: [{ roll: "desc" }, { sortOrder: "asc" }],
                  },
                },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      });

      if (!auth || !auth.characterId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No character selected",
        });
      }

      if (auth.session.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not active",
        });
      }

      // Find active encounter
      const activeEncounter = auth.session.activeEncounterId
        ? (auth.session.encounters.find(
            (e) => e.id === auth.session.activeEncounterId
          ) ?? null)
        : null;

      // If there's an active encounter with initiative, check if it's their turn
      if (activeEncounter) {
        const initiative = activeEncounter.initiative;
        if (initiative.length > 0) {
          const currentEntry = initiative[activeEncounter.currentTurn ?? 0];
          if (currentEntry?.characterId !== auth.characterId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Not your turn",
            });
          }
        }
      }
      // If no active encounter, players can move freely

      if (!auth.session.activeMapId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active map" });
      }

      // Check cache first for current position, fall back to DB
      const cachedPos = sessionStateCache.getTokenPosition(
        auth.sessionId,
        auth.characterId,
        auth.session.activeMapId
      );

      let tokenId: string;
      let currentX: number;
      let currentY: number;

      if (cachedPos) {
        tokenId = cachedPos.tokenId;
        currentX = cachedPos.x;
        currentY = cachedPos.y;
      } else {
        // Not in cache — load from DB (or create)
        let token = await ctx.db.playerToken.findUnique({
          where: {
            sessionId_characterId_mapId: {
              sessionId: auth.sessionId,
              characterId: auth.characterId,
              mapId: auth.session.activeMapId,
            },
          },
        });

        if (!token) {
          token = await ctx.db.playerToken.create({
            data: {
              sessionId: auth.sessionId,
              characterId: auth.characterId,
              mapId: auth.session.activeMapId,
              x: 0,
              y: 0,
            },
          });
        }

        tokenId = token.id;
        currentX = token.x;
        currentY = token.y;

        // Seed cache so future moves skip the DB lookup
        sessionStateCache.seedTokenPosition(
          token.id,
          auth.sessionId,
          auth.characterId,
          auth.session.activeMapId,
          token.x,
          token.y
        );
      }

      // Get map bounds
      const map = await ctx.db.gameMap.findUnique({
        where: { id: auth.session.activeMapId },
      });
      if (!map) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Map not found" });
      }

      let x = currentX;
      let y = currentY;
      switch (input.direction) {
        case "up":
          y = Math.max(0, y - 1);
          break;
        case "down":
          y = Math.min(map.gridRows - 1, y + 1);
          break;
        case "left":
          x = Math.max(0, x - 1);
          break;
        case "right":
          x = Math.min(map.gridCols - 1, x + 1);
          break;
      }

      // Update cache (no DB write — periodic flush handles persistence)
      sessionStateCache.updateTokenPosition(
        tokenId,
        auth.sessionId,
        auth.characterId!,
        auth.session.activeMapId!,
        x,
        y
      );

      // Broadcast to all clients immediately
      sessionHub.broadcast(auth.sessionId, {
        type: "session:token-moved",
        data: {
          characterId: auth.characterId!,
          mapId: auth.session.activeMapId!,
          x,
          y,
        },
      });

      return { id: tokenId, x, y };
    }),
});
