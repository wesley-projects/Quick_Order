import { AdapterNotConfiguredError, type RetailerAdapter } from "@/lib/checker/types";

/**
 * Retailers with no adapter written yet.
 *
 * These deliberately do nothing. Each one names the route to a working
 * implementation so filling it in is a contained job, and until then the
 * runner skips the retailer instead of failing it every cycle.
 *
 * Before you implement one: check that retailer's robots.txt and terms, and
 * prefer an official or affiliate API over parsing a storefront. Polling a
 * product page every few seconds from a datacenter IP gets you blocked, and
 * on some sites it breaches the terms you agreed to. Keep intervals sane —
 * `Retailer.minIntervalSec` exists for exactly this.
 */
function stub(key: string, name: string, route: string): RetailerAdapter {
  return {
    key,
    name,
    configHint: route,
    isConfigured: () => false,
    async check() {
      throw new AdapterNotConfiguredError(key, route);
    },
  };
}

export const stubAdapters: RetailerAdapter[] = [
  stub(
    "target",
    "Target",
    "Target exposes an internal product/fulfillment JSON endpoint (redsky) that " +
      "needs a visitor key and a store id. Implement check() to call it with " +
      "Listing.sku as the TCIN, then read availability_status and price.",
  ),
  stub(
    "walmart",
    "Walmart",
    "Walmart has an affiliate/marketplace API that returns price and " +
      "availability per item id. Request access, set WALMART_API_KEY, then " +
      "implement check() using Listing.sku as the item id.",
  ),
  stub(
    "pokemon-center",
    "Pokemon Center",
    "No public API. The storefront renders stock state client-side, so this " +
      "needs either a headless browser or the storefront's own JSON calls. " +
      "Expect aggressive bot protection and rate-limit hard.",
  ),
  stub(
    "costco",
    "Costco",
    "No public API and membership-gated pricing. Practical route is an " +
      "authenticated session plus their product JSON endpoint.",
  ),
];
