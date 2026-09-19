import { prisma } from "@/lib/prisma";
import {
  PRODUCT_KIND_LABEL,
  STOCK_STATUS,
  type ProductKind,
  type StockStatus,
} from "@/lib/constants";
import { isAtRetail, markupPercent } from "@/lib/utils";
import { isDemoMode, getAdapter } from "@/lib/checker/registry";
import type { BoardFilters, EventView, OfferView, ProductView } from "@/types";

/** Rank used when choosing which offer represents a product on the board. */
const STATUS_RANK: Record<StockStatus, number> = {
  IN_STOCK: 0,
  PREORDER: 1,
  UNKNOWN: 2,
  OUT_OF_STOCK: 3,
};

function adapterConfigured(adapterKey: string): boolean {
  if (isDemoMode()) return true;
  return getAdapter(adapterKey)?.isConfigured() ?? false;
}

type ListingWithRetailer = {
  id: string;
  url: string;
  status: string;
  priceCents: number | null;
  lastCheckedAt: Date | null;
  lastInStockAt: Date | null;
  retailer: { name: string; slug: string; accent: string; adapterKey: string };
};

function toOffer(listing: ListingWithRetailer, msrpCents: number): OfferView {
  const status = listing.status as StockStatus;
  return {
    listingId: listing.id,
    retailerName: listing.retailer.name,
    retailerSlug: listing.retailer.slug,
    accent: listing.retailer.accent,
    url: listing.url,
    status,
    priceCents: listing.priceCents,
    atRetail: status === STOCK_STATUS.IN_STOCK && isAtRetail(listing.priceCents, msrpCents),
    markupPercent: markupPercent(listing.priceCents, msrpCents),
    lastCheckedAt: listing.lastCheckedAt?.toISOString() ?? null,
    lastInStockAt: listing.lastInStockAt?.toISOString() ?? null,
    adapterConfigured: adapterConfigured(listing.retailer.adapterKey),
  };
}

/**
 * Pick the offer that represents a product: in stock beats preorder beats
 * sold out, and within a status the cheapest wins. A sold-out listing never
 * outranks something you can actually buy, however cheap it is.
 */
function pickBest(offers: OfferView[]): OfferView | null {
  const buyable = offers.filter(
    (o) => o.status === STOCK_STATUS.IN_STOCK || o.status === STOCK_STATUS.PREORDER,
  );
  const pool = buyable.length > 0 ? buyable : offers;
  if (pool.length === 0) return null;

  return [...pool].sort((a, b) => {
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    if (a.priceCents == null) return 1;
    if (b.priceCents == null) return -1;
    return a.priceCents - b.priceCents;
  })[0];
}

function toProductView(product: {
  id: string;
  slug: string;
  name: string;
  setName: string;
  kind: string;
  msrpCents: number;
  imageUrl: string | null;
  description: string | null;
  releaseDate: Date | null;
  listings: ListingWithRetailer[];
}): ProductView {
  const offers = product.listings.map((l) => toOffer(l, product.msrpCents));
  const kind = product.kind as ProductKind;
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    setName: product.setName,
    kind,
    kindLabel: PRODUCT_KIND_LABEL[kind] ?? product.kind,
    msrpCents: product.msrpCents,
    imageUrl: product.imageUrl,
    description: product.description,
    releaseDate: product.releaseDate?.toISOString() ?? null,
    offers: offers.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]),
    bestOffer: pickBest(offers),
    inStockCount: offers.filter((o) => o.status === STOCK_STATUS.IN_STOCK).length,
    atRetailCount: offers.filter((o) => o.atRetail).length,
  };
}

const PRODUCT_INCLUDE = {
  listings: {
    where: { isActive: true, retailer: { isEnabled: true } },
    include: {
      retailer: { select: { name: true, slug: true, accent: true, adapterKey: true } },
    },
  },
} as const;

export async function getBoard(filters: BoardFilters = {}): Promise<ProductView[]> {
  const products = await prisma.product.findMany({
    where: {
      isTracked: true,
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.set ? { setName: filters.set } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q } },
              { setName: { contains: filters.q } },
            ],
          }
        : {}),
    },
    include: PRODUCT_INCLUDE,
    orderBy: { name: "asc" },
  });

  let views = products.map(toProductView);

  if (filters.inStockOnly) views = views.filter((p) => p.inStockCount > 0);
  if (filters.atRetailOnly) views = views.filter((p) => p.atRetailCount > 0);

  switch (filters.sort) {
    case "price":
      views.sort(
        (a, b) => (a.bestOffer?.priceCents ?? Infinity) - (b.bestOffer?.priceCents ?? Infinity),
      );
      break;
    case "msrp":
      views.sort((a, b) => a.msrpCents - b.msrpCents);
      break;
    case "name":
      views.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      // Relevance: what you can buy at retail right now, first.
      views.sort((a, b) => {
        if (a.atRetailCount !== b.atRetailCount) return b.atRetailCount - a.atRetailCount;
        if (a.inStockCount !== b.inStockCount) return b.inStockCount - a.inStockCount;
        return a.name.localeCompare(b.name);
      });
  }

  return views;
}

export async function getProduct(slug: string): Promise<ProductView | null> {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: PRODUCT_INCLUDE,
  });
  return product ? toProductView(product) : null;
}

export async function getRecentEvents(limit = 40, onlyAtRetail = false): Promise<EventView[]> {
  const events = await prisma.stockEvent.findMany({
    where: onlyAtRetail ? { atRetail: true } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      listing: {
        include: {
          product: { select: { name: true, slug: true } },
          retailer: { select: { name: true, accent: true } },
        },
      },
    },
  });

  return events.map((event) => ({
    id: event.id,
    kind: event.kind,
    createdAt: event.createdAt.toISOString(),
    priceCents: event.priceCents,
    prevPriceCents: event.prevPriceCents,
    msrpCents: event.msrpCents,
    atRetail: event.atRetail,
    productName: event.listing.product.name,
    productSlug: event.listing.product.slug,
    retailerName: event.listing.retailer.name,
    accent: event.listing.retailer.accent,
    url: event.listing.url,
  }));
}

export async function getFacets(): Promise<{ sets: string[]; kinds: ProductKind[] }> {
  const products = await prisma.product.findMany({
    where: { isTracked: true },
    select: { setName: true, kind: true },
  });
  return {
    sets: [...new Set(products.map((p) => p.setName))].sort(),
    kinds: [...new Set(products.map((p) => p.kind as ProductKind))].sort(),
  };
}

export async function getProductEvents(productId: string, limit = 25): Promise<EventView[]> {
  const events = await prisma.stockEvent.findMany({
    where: { listing: { productId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      listing: {
        include: {
          product: { select: { name: true, slug: true } },
          retailer: { select: { name: true, accent: true } },
        },
      },
    },
  });

  return events.map((event) => ({
    id: event.id,
    kind: event.kind,
    createdAt: event.createdAt.toISOString(),
    priceCents: event.priceCents,
    prevPriceCents: event.prevPriceCents,
    msrpCents: event.msrpCents,
    atRetail: event.atRetail,
    productName: event.listing.product.name,
    productSlug: event.listing.product.slug,
    retailerName: event.listing.retailer.name,
    accent: event.listing.retailer.accent,
    url: event.listing.url,
  }));
}
