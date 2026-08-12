import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { generateShortCode } from "~/lib/utils";
import { sessionHub } from "~/server/ws/session-hub";
import { sessionStateCache } from "~/server/ws/session-state-cache";

export const gameSessionRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        name: z.string().min(1),
        mapIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.campaign.findFirstOrThrow({
        where: { id: input.campaignId, userId: ctx.session.user.id },
      });

      // Generate unique short code
      let shortCode: string;
      let exists = true;
      do {
        shortCode = generateShortCode();
        const existing = await ctx.db.gameSession.findUnique({
          where: { shortCode },
        });
        exists = !!existing;
      } while (exists);

      return ctx.db.gameSession.create({
        data: {
          name: input.name,
          shortCode,
          campaignId: input.campaignId,
          activeMapId: input.mapIds[0],
          sessionMaps: {
            create: input.mapIds.map((mapId, index) => ({
              mapId,
              sortOrder: index,
            })),
          },
        },
        include: {
          sessionMaps: { include: { map: true } },
          campaign: true,
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.id },
        include: {
          campaign: {
            include: { characters: true },
          },
          sessionMaps: {
            include: { map: true },
            orderBy: { sortOrder: "asc" },
          },
          tokens: {
            include: { character: true },
          },
          encounters: {
            include: {
              initiative: {
                include: { character: true },
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

      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return session;
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.id },
        include: { campaign: true },
      });
      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const result = await ctx.db.gameSession.update({
        where: { id: input.id },
        data: { status: "active" },
      });
      sessionHub.broadcast(input.id, {
        type: "session:status-changed",
        data: { status: "active" },
      });
      return result;
    }),

  end: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.id },
        include: { campaign: true },
      });
      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const result = await ctx.db.gameSession.update({
        where: { id: input.id },
        data: { status: "completed", activeEncounterId: null },
      });
      sessionHub.broadcast(input.id, {
        type: "session:status-changed",
        data: { status: "completed", activeEncounterId: null },
      });
      return result;
    }),

  // ─── Encounter Management ────────────────────────────────────

  startEncounter: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.sessionId },
        include: { campaign: true },
      });
      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const encounter = await ctx.db.encounter.create({
        data: {
          name: input.name,
          sessionId: input.sessionId,
          status: "active",
        },
      });

      await ctx.db.gameSession.update({
        where: { id: input.sessionId },
        data: { activeEncounterId: encounter.id },
      });

      sessionHub.broadcast(input.sessionId, {
        type: "session:encounter-started",
        data: {
          id: encounter.id,
          name: encounter.name,
          sessionId: encounter.sessionId,
          status: encounter.status,
          currentTurn: encounter.currentTurn,
          initiative: [],
        },
      });

      return encounter;
    }),

  endEncounter: protectedProcedure
    .input(z.object({ sessionId: z.string(), encounterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.sessionId },
        include: { campaign: true },
      });
      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await ctx.db.encounter.update({
        where: { id: input.encounterId },
        data: { status: "completed" },
      });

      const newActiveId =
        session.activeEncounterId === input.encounterId
          ? null
          : session.activeEncounterId;

      if (session.activeEncounterId === input.encounterId) {
        await ctx.db.gameSession.update({
          where: { id: input.sessionId },
          data: { activeEncounterId: null },
        });
      }

      sessionHub.broadcast(input.sessionId, {
        type: "session:encounter-ended",
        data: {
          encounterId: input.encounterId,
          activeEncounterId: newActiveId,
        },
      });

      return { success: true };
    }),

  setActiveMap: protectedProcedure
    .input(z.object({ sessionId: z.string(), mapId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.sessionId },
        include: { campaign: true },
      });
      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const result = await ctx.db.gameSession.update({
        where: { id: input.sessionId },
        data: { activeMapId: input.mapId },
      });
      sessionHub.broadcast(input.sessionId, {
        type: "session:map-changed",
        data: { activeMapId: input.mapId },
      });
      return result;
    }),

  // ─── Initiative (scoped to encounters) ───────────────────────

  addToInitiative: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        encounterId: z.string(),
        characterId: z.string(),
        roll: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.sessionId },
        include: { campaign: true },
      });
      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const count = await ctx.db.initiativeEntry.count({
        where: { encounterId: input.encounterId },
      });
      const result = await ctx.db.initiativeEntry.upsert({
        where: {
          encounterId_characterId: {
            encounterId: input.encounterId,
            characterId: input.characterId,
          },
        },
        update: { roll: input.roll },
        create: {
          encounterId: input.encounterId,
          characterId: input.characterId,
          roll: input.roll,
          sortOrder: count,
        },
      });

      // Broadcast updated initiative list
      const initiative = await ctx.db.initiativeEntry.findMany({
        where: { encounterId: input.encounterId },
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
      });
      sessionHub.broadcast(input.sessionId, {
        type: "session:initiative-updated",
        data: { encounterId: input.encounterId, initiative },
      });

      return result;
    }),

  removeFromInitiative: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        encounterId: z.string(),
        characterId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.sessionId },
        include: { campaign: true },
      });
      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const result = await ctx.db.initiativeEntry.delete({
        where: {
          encounterId_characterId: {
            encounterId: input.encounterId,
            characterId: input.characterId,
          },
        },
      });

      // Broadcast updated initiative list
      const initiative = await ctx.db.initiativeEntry.findMany({
        where: { encounterId: input.encounterId },
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
      });
      sessionHub.broadcast(input.sessionId, {
        type: "session:initiative-updated",
        data: { encounterId: input.encounterId, initiative },
      });

      return result;
    }),

  nextTurn: protectedProcedure
    .input(z.object({ sessionId: z.string(), encounterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.sessionId },
        include: { campaign: true },
      });
      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const encounter = await ctx.db.encounter.findFirstOrThrow({
        where: { id: input.encounterId },
        include: { initiative: true },
      });
      const total = encounter.initiative.length;
      if (total === 0) return encounter;
      const nextTurn = ((encounter.currentTurn ?? 0) + 1) % total;
      const result = await ctx.db.encounter.update({
        where: { id: input.encounterId },
        data: { currentTurn: nextTurn },
      });
      sessionHub.broadcast(input.sessionId, {
        type: "session:turn-changed",
        data: { encounterId: input.encounterId, currentTurn: nextTurn },
      });
      return result;
    }),

  prevTurn: protectedProcedure
    .input(z.object({ sessionId: z.string(), encounterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.sessionId },
        include: { campaign: true },
      });
      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const encounter = await ctx.db.encounter.findFirstOrThrow({
        where: { id: input.encounterId },
        include: { initiative: true },
      });
      const total = encounter.initiative.length;
      if (total === 0) return encounter;
      const prevTurn = ((encounter.currentTurn ?? 0) - 1 + total) % total;
      const result = await ctx.db.encounter.update({
        where: { id: input.encounterId },
        data: { currentTurn: prevTurn },
      });
      sessionHub.broadcast(input.sessionId, {
        type: "session:turn-changed",
        data: { encounterId: input.encounterId, currentTurn: prevTurn },
      });
      return result;
    }),

  placeToken: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        characterId: z.string(),
        mapId: z.string(),
        x: z.number().int(),
        y: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.sessionId },
        include: { campaign: true },
      });
      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const token = await ctx.db.playerToken.upsert({
        where: {
          sessionId_characterId_mapId: {
            sessionId: input.sessionId,
            characterId: input.characterId,
            mapId: input.mapId,
          },
        },
        update: { x: input.x, y: input.y },
        create: input,
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
      });
      // Seed the cache so subsequent moves skip DB lookups
      sessionStateCache.seedTokenPosition(
        token.id,
        input.sessionId,
        input.characterId,
        input.mapId,
        token.x,
        token.y
      );

      sessionHub.broadcast(input.sessionId, {
        type: "session:token-placed",
        data: token,
      });
      return token;
    }),

  removeToken: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        characterId: z.string(),
        mapId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findFirstOrThrow({
        where: { id: input.sessionId },
        include: { campaign: true },
      });
      if (session.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const result = await ctx.db.playerToken.delete({
        where: {
          sessionId_characterId_mapId: {
            sessionId: input.sessionId,
            characterId: input.characterId,
            mapId: input.mapId,
          },
        },
      });
      // Remove from cache as well
      sessionStateCache.removeToken(
        input.sessionId,
        input.characterId,
        input.mapId
      );

      sessionHub.broadcast(input.sessionId, {
        type: "session:token-removed",
        data: { characterId: input.characterId, mapId: input.mapId },
      });
      return result;
    }),

  // Public: get session state for display/players (polling)
  getDisplayState: publicProcedure
    .input(z.object({ shortCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.gameSession.findUnique({
        where: { shortCode: input.shortCode },
        include: {
          campaign: { select: { name: true } },
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
        },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      const activeMap =
        session.sessionMaps.find((sm) => sm.mapId === session.activeMapId)
          ?.map ??
        session.sessionMaps[0]?.map ??
        null;

      const activeTokens = activeMap
        ? sessionStateCache.overlayTokenPositions(
            session.id,
            session.tokens.filter((t) => t.mapId === activeMap.id)
          )
        : [];

      const activeEncounter = session.activeEncounterId
        ? (session.encounters.find((e) => e.id === session.activeEncounterId) ??
          null)
        : null;

      return {
        id: session.id,
        name: session.name,
        shortCode: session.shortCode,
        status: session.status,
        campaignName: session.campaign.name,
        activeMap,
        tokens: activeTokens,
        activeEncounter,
        initiative: activeEncounter?.initiative ?? [],
        currentTurn: activeEncounter?.currentTurn ?? 0,
        maps: session.sessionMaps.map((sm) => ({
          id: sm.map.id,
          name: sm.map.name,
        })),
      };
    }),
});
