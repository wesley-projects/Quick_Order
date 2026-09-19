import { simulate } from "@/lib/checker/adapters/mock";
import { STOCK_STATUS } from "@/lib/constants";
import type { CheckTarget } from "@/lib/checker/types";

const target = (over: Partial<CheckTarget> = {}): CheckTarget => ({
  listingId: "listing-1",
  url: "https://example.com",
  sku: null,
  retailerSlug: "target",
  productSlug: "prismatic-evolutions-elite-trainer-box",
  productName: "Prismatic Evolutions Elite Trainer Box",
  msrpCents: 5999,
  ...over,
});

describe("simulate", () => {
  it("is stable within a ten-minute window", () => {
    const a = simulate(target(), new Date("2026-01-10T12:00:00Z"));
    const b = simulate(target(), new Date("2026-01-10T12:09:59Z"));
    expect(a).toEqual(b);
  });

  it("prices a big-box restock at exactly MSRP, never a cent over", () => {
    // Walk a few days of windows and assert every in-stock quote is at retail.
    let seen = 0;
    for (let i = 0; i < 2000; i++) {
      const at = new Date(Date.UTC(2026, 0, 1) + i * 10 * 60 * 1000);
      const result = simulate(target({ retailerSlug: "target" }), at);
      if (result.status === STOCK_STATUS.IN_STOCK) {
        expect(result.priceCents).toBe(5999);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("keeps the resale marketplace stocked and above MSRP", () => {
    let inStock = 0;
    let overMsrp = 0;
    for (let i = 0; i < 500; i++) {
      const at = new Date(Date.UTC(2026, 0, 1) + i * 10 * 60 * 1000);
      const result = simulate(target({ retailerSlug: "card-market" }), at);
      if (result.status === STOCK_STATUS.IN_STOCK) {
        inStock++;
        if ((result.priceCents ?? 0) > 5999) overMsrp++;
      }
    }
    // Unlimited supply: it should essentially always be available, and never
    // at retail — that contrast is what the "at retail" filter is proving.
    expect(inStock).toBeGreaterThan(450);
    expect(overMsrp).toBe(inStock);
  });

  it("restocks scarce big-box stock only occasionally", () => {
    let inStock = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const at = new Date(Date.UTC(2026, 0, 1) + i * 10 * 60 * 1000);
      if (simulate(target(), at).status === STOCK_STATUS.IN_STOCK) inStock++;
    }
    expect(inStock / N).toBeLessThan(0.1);
  });
});
