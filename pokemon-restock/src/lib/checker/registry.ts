import { mockAdapter } from "@/lib/checker/adapters/mock";
import { bestBuyAdapter } from "@/lib/checker/adapters/bestbuy";
import { stubAdapters } from "@/lib/checker/adapters/stubs";
import type { RetailerAdapter } from "@/lib/checker/types";

/**
 * Every adapter the app knows about, by `Retailer.adapterKey`.
 *
 * To add a retailer: write an adapter, register it here, and point a
 * Retailer row's adapterKey at it. Nothing else needs to change.
 */
const ADAPTERS: RetailerAdapter[] = [mockAdapter, bestBuyAdapter, ...stubAdapters];

const BY_KEY = new Map(ADAPTERS.map((adapter) => [adapter.key, adapter]));

export function getAdapter(key: string): RetailerAdapter | undefined {
  return BY_KEY.get(key);
}

export function listAdapters(): RetailerAdapter[] {
  return [...ADAPTERS];
}

/**
 * When DEMO_MODE is on, every retailer is checked by the simulator regardless
 * of its adapterKey. That is what makes a fresh clone interesting: real
 * adapters stay unconfigured, but the board still moves.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE !== "false";
}

export function resolveAdapter(adapterKey: string): RetailerAdapter | undefined {
  if (isDemoMode()) return mockAdapter;
  return getAdapter(adapterKey);
}
