import type { ProductKind, StockStatus } from "@/lib/constants";

export interface OfferView {
  listingId: string;
  retailerName: string;
  retailerSlug: string;
  accent: string;
  url: string;
  status: StockStatus;
  priceCents: number | null;
  atRetail: boolean;
  markupPercent: number | null;
  lastCheckedAt: string | null;
  lastInStockAt: string | null;
  adapterConfigured: boolean;
}

export interface ProductView {
  id: string;
  slug: string;
  name: string;
  setName: string;
  kind: ProductKind;
  kindLabel: string;
  msrpCents: number;
  imageUrl: string | null;
  description: string | null;
  releaseDate: string | null;
  offers: OfferView[];
  /** Cheapest in-stock offer, if any. This is what the board sorts on. */
  bestOffer: OfferView | null;
  inStockCount: number;
  atRetailCount: number;
}

export interface EventView {
  id: string;
  kind: string;
  createdAt: string;
  priceCents: number | null;
  prevPriceCents: number | null;
  msrpCents: number;
  atRetail: boolean;
  productName: string;
  productSlug: string;
  retailerName: string;
  accent: string;
  url: string;
}

export interface BoardFilters {
  q?: string;
  kind?: string;
  set?: string;
  inStockOnly?: boolean;
  atRetailOnly?: boolean;
  sort?: "relevance" | "price" | "msrp" | "name";
}
