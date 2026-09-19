import { prisma } from "@/lib/prisma";
import { STOCK_STATUS, type StockStatus } from "@/lib/constants";
import { resolveAdapter } from "@/lib/checker/registry";
import { diffCheck, isDue, type PriorState } from "@/lib/checker/diff";
import { dispatchAlerts } from "@/lib/notify";
import { AdapterNotConfiguredError, type CheckResult, type CheckTarget } from "@/lib/checker/types";

/** Checks run in parallel, but not unboundedly — retailers notice. */
const CONCURRENCY = 6;

export interface RunSummary {
  checked: number;
  skipped: number;
  failed: number;
  events: number;
  alerts: number;
  durationMs: number;
}

/** Run `worker` over `items` with a fixed number of workers in flight. */
async function pool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

interface ListingRow {
  id: string;
  url: string;
  sku: string | null;
  status: string;
  priceCents: number | null;
  lastCheckedAt: Date | null;
  failureCount: number;
  product: { id: string; slug: string; name: string; msrpCents: number };
  retailer: { slug: string; name: string; adapterKey: string; minIntervalSec: number };
}

/**
 * One polling cycle: find listings that are due, check them, persist what
 * changed, and notify watchers.
 *
 * Everything a single listing does is wrapped — one bad adapter must not
 * abort the cycle for the other listings.
 */
export async function runChecks(options: { force?: boolean } = {}): Promise<RunSummary> {
  const startedAt = Date.now();
  const now = new Date();

  const listings = (await prisma.listing.findMany({
    where: { isActive: true, product: { isTracked: true }, retailer: { isEnabled: true } },
    include: {
      product: { select: { id: true, slug: true, name: true, msrpCents: true } },
      retailer: { select: { slug: true, name: true, adapterKey: true, minIntervalSec: true } },
    },
  })) as ListingRow[];

  const due = options.force
    ? listings
    : listings.filter((l) =>
        isDue(l.lastCheckedAt, l.retailer.minIntervalSec, l.failureCount, now),
      );

  const summary: RunSummary = {
    checked: 0,
    skipped: listings.length - due.length,
    failed: 0,
    events: 0,
    alerts: 0,
    durationMs: 0,
  };

  await pool(due, CONCURRENCY, async (listing) => {
    const adapter = resolveAdapter(listing.retailer.adapterKey);
    if (!adapter || !adapter.isConfigured()) {
      summary.skipped += 1;
      return;
    }

    const target: CheckTarget = {
      listingId: listing.id,
      url: listing.url,
      sku: listing.sku,
      retailerSlug: listing.retailer.slug,
      productSlug: listing.product.slug,
      productName: listing.product.name,
      msrpCents: listing.product.msrpCents,
    };

    const checkStartedAt = Date.now();
    let result: CheckResult | null = null;
    let error: string | null = null;

    try {
      result = await adapter.check(target);
    } catch (err) {
      error =
        err instanceof AdapterNotConfiguredError
          ? err.message
          : `${(err as Error).name}: ${(err as Error).message}`;
    }

    const durationMs = Date.now() - checkStartedAt;
    summary.checked += 1;

    await prisma.checkRun.create({
      data: {
        listingId: listing.id,
        ok: error === null,
        status: result?.status ?? null,
        priceCents: result?.priceCents ?? null,
        error: error?.slice(0, 500) ?? null,
        durationMs,
      },
    });

    if (error !== null || !result) {
      summary.failed += 1;
      await prisma.listing.update({
        where: { id: listing.id },
        data: { failureCount: { increment: 1 }, lastCheckedAt: new Date() },
      });
      return;
    }

    const prior: PriorState = {
      status: listing.status as StockStatus,
      priceCents: listing.priceCents,
      hasBeenChecked: listing.lastCheckedAt !== null,
    };
    const draft = diffCheck(prior, result, listing.product.msrpCents);

    await prisma.listing.update({
      where: { id: listing.id },
      data: {
        status: result.status,
        // Keep the last known price when a sold-out listing stops quoting one:
        // "was $49.99 when it was up" is more useful than a blank.
        priceCents: result.priceCents ?? listing.priceCents,
        lastCheckedAt: new Date(),
        failureCount: 0,
        ...(result.status === STOCK_STATUS.IN_STOCK ? { lastInStockAt: new Date() } : {}),
      },
    });

    if (!draft) return;

    const event = await prisma.stockEvent.create({
      data: {
        listingId: listing.id,
        kind: draft.kind,
        status: draft.status,
        priceCents: draft.priceCents,
        prevPriceCents: draft.prevPriceCents,
        msrpCents: draft.msrpCents,
        atRetail: draft.atRetail,
      },
    });
    summary.events += 1;

    summary.alerts += await dispatchAlerts({
      stockEventId: event.id,
      productId: listing.product.id,
      productName: listing.product.name,
      productSlug: listing.product.slug,
      retailerName: listing.retailer.name,
      url: listing.url,
      priceCents: draft.priceCents,
      msrpCents: draft.msrpCents,
      kind: draft.kind,
    });
  });

  summary.durationMs = Date.now() - startedAt;
  return summary;
}
