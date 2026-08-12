import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const gameMapRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        name: z.string().min(1),
        imageUrl: z.string(),
        imageWidth: z.number().int().default(0),
        imageHeight: z.number().int().default(0),
        gridOffsetX: z.number().default(0),
        gridOffsetY: z.number().default(0),
        gridCellSize: z.number().default(50),
        gridRows: z.number().int().default(20),
        gridCols: z.number().int().default(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.campaign.findFirstOrThrow({
        where: { id: input.campaignId, userId: ctx.session.user.id },
      });
      return ctx.db.gameMap.create({ data: input });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        imageUrl: z.string().optional(),
        imageWidth: z.number().int().optional(),
        imageHeight: z.number().int().optional(),
        gridOffsetX: z.number().optional(),
        gridOffsetY: z.number().optional(),
        gridCellSize: z.number().optional(),
        gridRows: z.number().int().optional(),
        gridCols: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const map = await ctx.db.gameMap.findFirstOrThrow({
        where: { id },
        include: { campaign: true },
      });
      if (map.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.gameMap.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const map = await ctx.db.gameMap.findFirstOrThrow({
        where: { id: input.id },
        include: { campaign: true },
      });
      if (map.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.gameMap.delete({ where: { id: input.id } });
    }),
});
