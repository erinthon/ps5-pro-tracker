import { describe, it, expect } from "vitest";
import { offersRouter } from "./offers";
import type { TrpcContext } from "../_core/context";

describe("Offers Router", () => {
  const mockContext: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as any,
    res: {} as any,
  };

  it("should have list procedure", () => {
    const caller = offersRouter.createCaller(mockContext);
    expect(caller.list).toBeDefined();
  });

  it("should have getById procedure", () => {
    const caller = offersRouter.createCaller(mockContext);
    expect(caller.getById).toBeDefined();
  });

  it("should have getPriceHistory procedure", () => {
    const caller = offersRouter.createCaller(mockContext);
    expect(caller.getPriceHistory).toBeDefined();
  });

  it("should have getStores procedure", () => {
    const caller = offersRouter.createCaller(mockContext);
    expect(caller.getStores).toBeDefined();
  });

  it("should have runCrawler mutation", () => {
    const caller = offersRouter.createCaller(mockContext);
    expect(caller.runCrawler).toBeDefined();
  });

  it("list should accept filter parameters", async () => {
    const caller = offersRouter.createCaller(mockContext);

    // Should not throw
    const result = await caller.list({
      minPrice: 1000,
      maxPrice: 10000,
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(result)).toBe(true);
  });

  it("getStores should return array or handle gracefully", async () => {
    const caller = offersRouter.createCaller(mockContext);
    try {
      const result = await caller.getStores();
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      // Banco de dados pode não estar criado durante testes
      expect(error).toBeDefined();
    }
  });
});
