/** Stock states a listing can be in. Stored as strings so SQLite stays simple. */
export const STOCK_STATUS = {
  IN_STOCK: "IN_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  PREORDER: "PREORDER",
  /** We could not tell — a fetch failed, or the adapter is a stub. */
  UNKNOWN: "UNKNOWN",
} as const;

export type StockStatus = (typeof STOCK_STATUS)[keyof typeof STOCK_STATUS];

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  IN_STOCK: "In stock",
  OUT_OF_STOCK: "Sold out",
  PREORDER: "Preorder",
  UNKNOWN: "Unknown",
};

/** Kinds of event written to the restock feed. */
export const EVENT_KIND = {
  RESTOCK: "RESTOCK",
  SOLD_OUT: "SOLD_OUT",
  PRICE_CHANGE: "PRICE_CHANGE",
  PREORDER_OPEN: "PREORDER_OPEN",
} as const;

export type EventKind = (typeof EVENT_KIND)[keyof typeof EVENT_KIND];

export const PRODUCT_KIND = {
  ELITE_TRAINER_BOX: "ELITE_TRAINER_BOX",
  BOOSTER_BUNDLE: "BOOSTER_BUNDLE",
  BOOSTER_BOX: "BOOSTER_BOX",
  COLLECTION_BOX: "COLLECTION_BOX",
  TIN: "TIN",
  BLISTER: "BLISTER",
  SINGLE_PACK: "SINGLE_PACK",
} as const;

export type ProductKind = (typeof PRODUCT_KIND)[keyof typeof PRODUCT_KIND];

export const PRODUCT_KIND_LABEL: Record<ProductKind, string> = {
  ELITE_TRAINER_BOX: "Elite Trainer Box",
  BOOSTER_BUNDLE: "Booster Bundle",
  BOOSTER_BOX: "Booster Box",
  COLLECTION_BOX: "Collection Box",
  TIN: "Tin",
  BLISTER: "Blister Pack",
  SINGLE_PACK: "Single Pack",
};

export function isStockStatus(value: string): value is StockStatus {
  return value in STOCK_STATUS_LABEL;
}
