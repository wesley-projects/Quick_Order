import { STOCK_STATUS } from "@/lib/constants";
import { seededRandom } from "@/lib/checker/random";
import type { CheckResult, CheckTarget, RetailerAdapter } from "@/lib/checker/types";

/**
 * A simulator that behaves like the real thing: mostly sold out, restocking in
 * short windows, with prices that sit at MSRP for big-box stores and above it
 * for marketplaces. It exists so the site is alive on a fresh clone, and so
 * the runner, the feed and the alerting path can be exercised without
 * touching anyone's servers.
 */

/** How long a simulated restock lasts. Real ones are rarely longer. */
const WINDOW_MS = 10 * 60 * 1000;

/**
 * Prices drift on a much slower clock than stock does. Without this, a
 * listing that stays in stock would appear to re-price every ten minutes and
 * bury the feed in PRICE_CHANGE events.
 */
const PRICE_WINDOW_MS = 6 * 60 * 60 * 1000;

interface RetailerProfile {
  /** Probability any given window is a restock window. */
  restockRate: number;
  /** Typical markup over MSRP, as a fraction. 0 means it sells at retail. */
  markup: number;
  /** How much the markup varies between listings. */
  markupSpread: number;
  /**
   * Whether a product being in demand makes this retailer harder to catch.
   * True for anyone selling at MSRP — that is what scarcity means. False for
   * a resale marketplace, which always has supply at a price, so applying
   * scarcity to it would make it flicker in and out and bury the feed.
   */
  scarcitySensitive: boolean;
}

// Rates are per ten-minute window, so they look small on purpose: 0.025 is
// roughly a restock every seven hours. They sit a little above what a hot ETB
// really sees, so a fresh clone has something moving on the board; drop them
// if you want the demo to feel as scarce as the real thing.
//
// markupSpread of 0 means the store sells at exactly MSRP, which is what the
// big-box stores actually do — and it keeps the "at retail" badge meaningful
// rather than a coin flip either side of the line.
const DEFAULT_PROFILE: RetailerProfile = {
  restockRate: 0.02,
  markup: 0,
  markupSpread: 0,
  scarcitySensitive: true,
};

const PROFILES: Record<string, RetailerProfile> = {
  target: { restockRate: 0.025, markup: 0, markupSpread: 0, scarcitySensitive: true },
  walmart: { restockRate: 0.03, markup: 0, markupSpread: 0, scarcitySensitive: true },
  "best-buy": { restockRate: 0.02, markup: 0, markupSpread: 0, scarcitySensitive: true },
  "pokemon-center": { restockRate: 0.015, markup: 0, markupSpread: 0, scarcitySensitive: true },
  costco: { restockRate: 0.012, markup: -0.05, markupSpread: 0.02, scarcitySensitive: true },
  // A marketplace: essentially always has stock, never at retail. Useful
  // contrast on the board — it proves the "at retail" filter is doing
  // something, and it keeps the page from ever looking empty.
  "card-market": {
    restockRate: 0.99,
    markup: 0.75,
    markupSpread: 0.4,
    scarcitySensitive: false,
  },
};

export function simulate(target: CheckTarget, now: Date): CheckResult {
  const profile = PROFILES[target.retailerSlug] ?? DEFAULT_PROFILE;
  const window = Math.floor(now.getTime() / WINDOW_MS);
  const windowKey = `${target.listingId}:${window}`;

  // Hot products sell out faster than they restock; derive "hotness" from the
  // product so it is stable, not from the clock.
  const hotness = seededRandom(`hot:${target.productSlug}`);
  const effectiveRate = profile.scarcitySensitive
    ? profile.restockRate * (1 - hotness * 0.6)
    : profile.restockRate;

  if (seededRandom(`stock:${windowKey}`) > effectiveRate) {
    return { status: STOCK_STATUS.OUT_OF_STOCK, priceCents: null, note: "simulated" };
  }

  const priceWindow = Math.floor(now.getTime() / PRICE_WINDOW_MS);
  const spread =
    (seededRandom(`price:${target.listingId}:${priceWindow}`) - 0.5) * 2 * profile.markupSpread;
  const multiplier = 1 + profile.markup + spread;

  // A store selling at MSRP must land on MSRP exactly. Rounding to the
  // nearest nickel would put $59.99 at $60.00 and quietly fail the
  // at-retail test on every single restock.
  const priceCents =
    multiplier === 1
      ? target.msrpCents
      : Math.max(100, Math.round((target.msrpCents * multiplier) / 5) * 5);

  return { status: STOCK_STATUS.IN_STOCK, priceCents, note: "simulated" };
}

export const mockAdapter: RetailerAdapter = {
  key: "mock",
  name: "Simulated retailer",
  isConfigured: () => true,
  configHint: "Always available — generates demo data.",
  async check(target) {
    return simulate(target, new Date());
  },
};
