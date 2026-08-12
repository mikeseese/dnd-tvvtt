import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { campaignRouter } from "~/server/api/routers/campaign";
import { characterRouter } from "~/server/api/routers/character";
import { gameMapRouter } from "~/server/api/routers/game-map";
import { gameSessionRouter } from "~/server/api/routers/game-session";
import { playerRouter } from "~/server/api/routers/player";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  campaign: campaignRouter,
  character: characterRouter,
  gameMap: gameMapRouter,
  gameSession: gameSessionRouter,
  player: playerRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.studio.getMyStudios();
 *       ^? Studio[]
 */
export const createCaller = createCallerFactory(appRouter);
