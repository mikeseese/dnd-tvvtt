import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const characterRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        campaignId: z.string(),
        fullName: z.string().min(1),
        nickname: z.string().nullable().optional(),
        playerName: z.string().nullable().optional(),
        level: z.number().int().min(1).default(1),
        characterClass: z.string().min(1),
        race: z.string().min(1),
        fullImageUrl: z.string().nullable().optional(),
        avatarImageUrl: z.string().nullable().optional(),
        externalLink: z.string().nullable().optional(),
        currentHp: z.number().int(),
        maxHp: z.number().int(),
        ac: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.campaign.findFirstOrThrow({
        where: { id: input.campaignId, userId: ctx.session.user.id },
      });
      return ctx.db.playerCharacter.create({ data: input });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        fullName: z.string().min(1).optional(),
        nickname: z.string().nullable().optional(),
        playerName: z.string().nullable().optional(),
        level: z.number().int().min(1).optional(),
        characterClass: z.string().min(1).optional(),
        race: z.string().min(1).optional(),
        fullImageUrl: z.string().nullable().optional(),
        avatarImageUrl: z.string().nullable().optional(),
        externalLink: z.string().nullable().optional(),
        currentHp: z.number().int().optional(),
        maxHp: z.number().int().optional(),
        ac: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const char = await ctx.db.playerCharacter.findFirstOrThrow({
        where: { id },
        include: { campaign: true },
      });
      if (char.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.playerCharacter.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const char = await ctx.db.playerCharacter.findFirstOrThrow({
        where: { id: input.id },
        include: { campaign: true },
      });
      if (char.campaign.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return ctx.db.playerCharacter.delete({ where: { id: input.id } });
    }),
});
