import { EVENT_KIND, STOCK_STATUS, type EventKind, type StockStatus } from "@/lib/constants";
import { isAtRetail } from "@/lib/utils";
import type { CheckResult } from "@/lib/checker/types";

/**
 * A price move has to clear both of these to be worth an event. Retailers
 * nudge prices by a few cents constantly; without a floor the feed fills with
 * movement nobody would act on.
 */
const PRICE_NOISE_CENTS = 50;
const PRICE_NOISE_FRACTION = 0.01;

/** Is this price move big enough to tell anyone about? */
export function isSignificantPriceMove(prevCents: number, nextCents: number): boolean {
  const delta = Math.abs(nextCents - prevCents);
  return delta >= PRICE_NOISE_CENTS && delta >= prevCents * PRICE_NOISE_FRACTION;
}

export interface PriorState {
  status: StockStatus;
  priceCents: number | null;
  /** False for a listing we have never successfully checked. */
  hasBeenChecked: boolean;
}

export interface EventDraft {
  kind: EventKind;
  status: StockStatus;
  priceCents: number | null;
  prevPriceCents: number | null;
  msrpCents: number;
  atRetail: boolean;
}

/**
 * Decide whether a check is worth recording as an event.
 *
 * The rules that matter:
 *  - UNKNOWN never produces an event. A failed fetch is not news.
 *  - The first successful check of a listing never produces an event either,
 *    or seeding the database would fire a restock alert for everything that
 *    happens to be in stock at that moment.
 *  - Only transitions count. A listing that is still sold out is not a
 *    SOLD_OUT event, and a price that has not moved meaningfully is not a
 *    PRICE_CHANGE — see PRICE_NOISE_* below.
 */
export function diffCheck(
  prev: PriorState,
  next: CheckResult,
  msrpCents: number,
): EventDraft | null {
  if (next.status === STOCK_STATUS.UNKNOWN) return null;

  const base = {
    status: next.status,
    priceCents: next.priceCents,
    prevPriceCents: prev.priceCents,
    msrpCents,
    atRetail: isAtRetail(next.priceCents, msrpCents),
  };

  if (!prev.hasBeenChecked) return null;

  if (next.status !== prev.status) {
    switch (next.status) {
      case STOCK_STATUS.IN_STOCK:
        return { ...base, kind: EVENT_KIND.RESTOCK };
      case STOCK_STATUS.PREORDER:
        return { ...base, kind: EVENT_KIND.PREORDER_OPEN };
      case STOCK_STATUS.OUT_OF_STOCK:
        // Going quiet only counts once we had seen it available. Coming back
        // from UNKNOWN to sold out tells the user nothing.
        return prev.status === STOCK_STATUS.UNKNOWN
          ? null
          : { ...base, kind: EVENT_KIND.SOLD_OUT };
      default:
        return null;
    }
  }

  const priceMoved =
    next.priceCents != null &&
    prev.priceCents != null &&
    isSignificantPriceMove(prev.priceCents, next.priceCents);

  if (priceMoved && next.status === STOCK_STATUS.IN_STOCK) {
    return { ...base, kind: EVENT_KIND.PRICE_CHANGE };
  }

  return null;
}

/**
 * How long to wait before retrying a listing, given how many checks in a row
 * have failed. Exponential, capped at an hour — a dead URL should not keep
 * costing a request every cycle.
 */
export function backoffSeconds(baseIntervalSec: number, failureCount: number): number {
  if (failureCount <= 0) return baseIntervalSec;
  const factor = Math.min(2 ** failureCount, 32);
  return Math.min(baseIntervalSec * factor, 3600);
}

/** Is this listing due for another check? */
export function isDue(
  lastCheckedAt: Date | null,
  baseIntervalSec: number,
  failureCount: number,
  now: Date = new Date(),
): boolean {
  if (!lastCheckedAt) return true;
  const waitMs = backoffSeconds(baseIntervalSec, failureCount) * 1000;
  return now.getTime() - lastCheckedAt.getTime() >= waitMs;
}
