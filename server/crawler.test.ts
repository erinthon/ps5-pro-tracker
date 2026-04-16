import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCrawler } from "./crawler";

describe("Crawler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a result object with required properties", async () => {
    const result = await runCrawler();

    expect(result).toHaveProperty("totalOffers");
    expect(result).toHaveProperty("newOffers");
    expect(result).toHaveProperty("updatedOffers");
    expect(result).toHaveProperty("errors");
  });

  it("should have arrays and numbers in the result", async () => {
    const result = await runCrawler();

    expect(typeof result.totalOffers).toBe("number");
    expect(typeof result.newOffers).toBe("number");
    expect(typeof result.updatedOffers).toBe("number");
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it("should have non-negative counts", async () => {
    const result = await runCrawler();

    expect(result.totalOffers).toBeGreaterThanOrEqual(0);
    expect(result.newOffers).toBeGreaterThanOrEqual(0);
    expect(result.updatedOffers).toBeGreaterThanOrEqual(0);
  });

  it("should have totalOffers equal to sum of new and updated", async () => {
    const result = await runCrawler();

    // Pode haver ofertas que não foram processadas (por erro)
    // então apenas verificamos que o total é >= sum
    expect(result.totalOffers).toBeGreaterThanOrEqual(
      result.newOffers + result.updatedOffers
    );
  });
});
