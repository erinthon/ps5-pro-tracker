import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getOffersWithFilters, getOfferById, getPriceHistoryForOffer, getStores } from "../db";
import { runCrawlerManually } from "../scheduler";

export const offersRouter = router({
  list: publicProcedure
    .input(
      z.object({
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        storeId: z.number().optional(),
        inStock: z.boolean().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        const result = await getOffersWithFilters({
          minPrice: input.minPrice,
          maxPrice: input.maxPrice,
          storeId: input.storeId,
          inStock: input.inStock,
          limit: input.limit,
          offset: input.offset,
        });
        return result;
      } catch (error) {
        console.error("[Offers Router] Erro ao listar ofertas:", error);
        return [];
      }
    }),

  getById: publicProcedure.input(z.number()).query(async ({ input }) => {
    return getOfferById(input);
  }),

  getPriceHistory: publicProcedure.input(z.number()).query(async ({ input }) => {
    return getPriceHistoryForOffer(input);
  }),

  getStores: publicProcedure.query(async () => {
    return getStores();
  }),

  runCrawler: publicProcedure.mutation(async () => {
    try {
      const result = await runCrawlerManually();
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }),
});
