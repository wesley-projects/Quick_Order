import type { StockStatus } from "@/lib/constants";

/** Everything an adapter needs to know about what it is checking. */
export interface CheckTarget {
  listingId: string;
  url: string;
  sku: string | null;
  retailerSlug: string;
  productSlug: string;
  productName: string;
  msrpCents: number;
}

/** What an adapter reports back. `status: UNKNOWN` means "could not tell". */
export interface CheckResult {
  status: StockStatus;
  priceCents: number | null;
  /** Free-form detail for the /status page — an HTTP code, a parse note. */
  note?: string;
}

export interface RetailerAdapter {
  /** Matches `Retailer.adapterKey` in the database. */
  key: string;
  name: string;
  /**
   * True when the adapter can actually run — a stub with no API key
   * configured reports false and is skipped rather than failing every cycle.
   */
  isConfigured(): boolean;
  /** Why it is not configured, shown on /status. */
  configHint?: string;
  check(target: CheckTarget): Promise<CheckResult>;
}

/** Thrown by adapters that need credentials or an endpoint they do not have. */
export class AdapterNotConfiguredError extends Error {
  constructor(adapterKey: string, hint: string) {
    super(`Adapter "${adapterKey}" is not configured: ${hint}`);
    this.name = "AdapterNotConfiguredError";
  }
}
