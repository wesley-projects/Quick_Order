import { STOCK_STATUS } from "@/lib/constants";
import { fetchWithTimeout } from "@/lib/checker/http";
import {
  AdapterNotConfiguredError,
  type CheckResult,
  type CheckTarget,
  type RetailerAdapter,
} from "@/lib/checker/types";

/**
 * Best Buy publishes an official Products API, so this adapter is real rather
 * than a stub: get a key at https://developer.bestbuy.com and set
 * BESTBUY_API_KEY. The listing's `sku` column holds the Best Buy SKU.
 */

const ENDPOINT = "https://api.bestbuy.com/v1/products";

interface BestBuyProduct {
  sku: number;
  name: string;
  salePrice: number | null;
  regularPrice: number | null;
  onlineAvailability: boolean | null;
  orderable: string | null;
}

/** Best Buy's `orderable` vocabulary, mapped onto ours. */
export function mapOrderable(
  orderable: string | null,
  onlineAvailability: boolean | null,
): CheckResult["status"] {
  switch (orderable) {
    case "Available":
      return onlineAvailability === false ? STOCK_STATUS.OUT_OF_STOCK : STOCK_STATUS.IN_STOCK;
    case "SoldOut":
    case "Discontinued":
      return STOCK_STATUS.OUT_OF_STOCK;
    case "ComingSoon":
    case "Preorder":
      return STOCK_STATUS.PREORDER;
    default:
      // Unrecognised value: say we do not know rather than guessing wrong. A
      // false "in stock" is worse than no answer.
      return onlineAvailability === true ? STOCK_STATUS.IN_STOCK : STOCK_STATUS.UNKNOWN;
  }
}

export const bestBuyAdapter: RetailerAdapter = {
  key: "bestbuy",
  name: "Best Buy (official API)",
  configHint: "Set BESTBUY_API_KEY — free key from developer.bestbuy.com.",
  isConfigured: () => Boolean(process.env.BESTBUY_API_KEY),

  async check(target: CheckTarget): Promise<CheckResult> {
    const apiKey = process.env.BESTBUY_API_KEY;
    if (!apiKey) {
      throw new AdapterNotConfiguredError("bestbuy", "BESTBUY_API_KEY is not set");
    }
    if (!target.sku) {
      throw new Error("Best Buy listings need the SKU in Listing.sku");
    }

    const params = new URLSearchParams({
      apiKey,
      format: "json",
      show: "sku,name,salePrice,regularPrice,onlineAvailability,orderable",
    });
    const res = await fetchWithTimeout(`${ENDPOINT}(sku=${target.sku})?${params}`);

    if (!res.ok) {
      throw new Error(`Best Buy API returned ${res.status}`);
    }

    const body = (await res.json()) as { products?: BestBuyProduct[] };
    const product = body.products?.[0];
    if (!product) {
      return { status: STOCK_STATUS.UNKNOWN, priceCents: null, note: "sku not found" };
    }

    const price = product.salePrice ?? product.regularPrice;
    return {
      status: mapOrderable(product.orderable, product.onlineAvailability),
      priceCents: price == null ? null : Math.round(price * 100),
      note: product.orderable ?? "no orderable field",
    };
  },
};
