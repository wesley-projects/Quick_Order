import { backoffSeconds, diffCheck, isDue, isSignificantPriceMove } from "@/lib/checker/diff";
import { EVENT_KIND, STOCK_STATUS } from "@/lib/constants";
import type { PriorState } from "@/lib/checker/diff";

const MSRP = 5999;

const prior = (over: Partial<PriorState> = {}): PriorState => ({
  status: STOCK_STATUS.OUT_OF_STOCK,
  priceCents: null,
  hasBeenChecked: true,
  ...over,
});

describe("diffCheck", () => {
  it("emits a RESTOCK when a sold-out listing comes back", () => {
    const event = diffCheck(
      prior(),
      { status: STOCK_STATUS.IN_STOCK, priceCents: 5999 },
      MSRP,
    );
    expect(event).toMatchObject({ kind: EVENT_KIND.RESTOCK, atRetail: true });
  });

  it("marks a restock above MSRP as not at retail", () => {
    const event = diffCheck(
      prior(),
      { status: STOCK_STATUS.IN_STOCK, priceCents: 9999 },
      MSRP,
    );
    expect(event).toMatchObject({ kind: EVENT_KIND.RESTOCK, atRetail: false });
  });

  it("emits SOLD_OUT only after the listing had been seen in stock", () => {
    const seen = diffCheck(
      prior({ status: STOCK_STATUS.IN_STOCK, priceCents: 5999 }),
      { status: STOCK_STATUS.OUT_OF_STOCK, priceCents: null },
      MSRP,
    );
    expect(seen).toMatchObject({ kind: EVENT_KIND.SOLD_OUT });

    const neverSeen = diffCheck(
      prior({ status: STOCK_STATUS.UNKNOWN }),
      { status: STOCK_STATUS.OUT_OF_STOCK, priceCents: null },
      MSRP,
    );
    expect(neverSeen).toBeNull();
  });

  it("stays silent on the first check of a listing", () => {
    const event = diffCheck(
      prior({ status: STOCK_STATUS.UNKNOWN, hasBeenChecked: false }),
      { status: STOCK_STATUS.IN_STOCK, priceCents: 5999 },
      MSRP,
    );
    expect(event).toBeNull();
  });

  it("stays silent when a failed check returns UNKNOWN", () => {
    const event = diffCheck(
      prior({ status: STOCK_STATUS.IN_STOCK, priceCents: 5999 }),
      { status: STOCK_STATUS.UNKNOWN, priceCents: null },
      MSRP,
    );
    expect(event).toBeNull();
  });

  it("stays silent when nothing changed", () => {
    const event = diffCheck(
      prior({ status: STOCK_STATUS.IN_STOCK, priceCents: 5999 }),
      { status: STOCK_STATUS.IN_STOCK, priceCents: 5999 },
      MSRP,
    );
    expect(event).toBeNull();
  });

  it("reports a meaningful price move but ignores noise", () => {
    const meaningful = diffCheck(
      prior({ status: STOCK_STATUS.IN_STOCK, priceCents: 9999 }),
      { status: STOCK_STATUS.IN_STOCK, priceCents: 5999 },
      MSRP,
    );
    expect(meaningful).toMatchObject({
      kind: EVENT_KIND.PRICE_CHANGE,
      prevPriceCents: 9999,
      atRetail: true,
    });

    const noise = diffCheck(
      prior({ status: STOCK_STATUS.IN_STOCK, priceCents: 9999 }),
      { status: STOCK_STATUS.IN_STOCK, priceCents: 9989 },
      MSRP,
    );
    expect(noise).toBeNull();
  });

  it("emits PREORDER_OPEN when a listing opens for preorder", () => {
    const event = diffCheck(
      prior(),
      { status: STOCK_STATUS.PREORDER, priceCents: 5999 },
      MSRP,
    );
    expect(event).toMatchObject({ kind: EVENT_KIND.PREORDER_OPEN });
  });
});

describe("isSignificantPriceMove", () => {
  it("needs both an absolute and a relative move", () => {
    expect(isSignificantPriceMove(5999, 5899)).toBe(true); // $1.00 and 1.7%
    expect(isSignificantPriceMove(5999, 5960)).toBe(false); // 39c: under the 50c floor
    expect(isSignificantPriceMove(5999, 5949)).toBe(false); // 50c but only 0.8%
    expect(isSignificantPriceMove(200, 150)).toBe(true); // 50c and 25%
    expect(isSignificantPriceMove(100000, 99600)).toBe(false); // $4 but only 0.4%
  });
});

describe("backoffSeconds", () => {
  it("returns the base interval when nothing has failed", () => {
    expect(backoffSeconds(180, 0)).toBe(180);
  });

  it("backs off exponentially and caps at an hour", () => {
    expect(backoffSeconds(180, 1)).toBe(360);
    expect(backoffSeconds(180, 3)).toBe(1440);
    expect(backoffSeconds(180, 10)).toBe(3600);
  });
});

describe("isDue", () => {
  const now = new Date("2026-01-10T12:00:00Z");

  it("is always due when never checked", () => {
    expect(isDue(null, 180, 0, now)).toBe(true);
  });

  it("waits out the interval", () => {
    expect(isDue(new Date("2026-01-10T11:59:00Z"), 180, 0, now)).toBe(false);
    expect(isDue(new Date("2026-01-10T11:56:00Z"), 180, 0, now)).toBe(true);
  });

  it("waits longer after failures", () => {
    expect(isDue(new Date("2026-01-10T11:56:00Z"), 180, 2, now)).toBe(false);
  });
});
