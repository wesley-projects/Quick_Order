import { prisma } from "@/lib/prisma";
import { EVENT_KIND } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { fetchWithTimeout } from "@/lib/checker/http";

export interface AlertContext {
  stockEventId: string;
  productId: string;
  productName: string;
  productSlug: string;
  retailerName: string;
  url: string;
  priceCents: number | null;
  msrpCents: number;
  kind: string;
}

function renderMessage(ctx: AlertContext): string {
  const price = formatCurrency(ctx.priceCents);
  const msrp = formatCurrency(ctx.msrpCents);
  const verdict = ctx.priceCents != null && ctx.priceCents <= ctx.msrpCents ? "AT RETAIL" : "over MSRP";
  return `🔔 ${ctx.productName} is in stock at ${ctx.retailerName} — ${price} (MSRP ${msrp}, ${verdict})\n${ctx.url}`;
}

/**
 * Deliver one alert. Webhook if ALERT_WEBHOOK_URL is set (Discord and Slack
 * both accept a `content`/`text` JSON body), otherwise the console.
 *
 * Email is deliberately not wired up: it needs a provider and a verified
 * sender, which is a deployment decision rather than a code one. Add a branch
 * here when you have one.
 */
async function deliver(ctx: AlertContext): Promise<{ channel: string; ok: boolean; error?: string }> {
  const webhook = process.env.ALERT_WEBHOOK_URL;
  const message = renderMessage(ctx);

  if (!webhook) {
    console.log(`[alert] ${message.replace(/\n/g, " ")}`);
    return { channel: "console", ok: true };
  }

  try {
    const res = await fetchWithTimeout(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: message, text: message }),
    });
    return res.ok
      ? { channel: "webhook", ok: true }
      : { channel: "webhook", ok: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return { channel: "webhook", ok: false, error: (err as Error).message };
  }
}

/**
 * Notify everyone watching this product, if the event is worth notifying
 * about. Returns how many alerts were sent.
 *
 * The Alert table's unique (watchId, stockEventId) is the dedupe guarantee —
 * a retried cycle cannot double-notify, because the insert fails rather than
 * relying on us remembering.
 */
export async function dispatchAlerts(ctx: AlertContext): Promise<number> {
  if (ctx.kind !== EVENT_KIND.RESTOCK && ctx.kind !== EVENT_KIND.PRICE_CHANGE) return 0;

  const watches = await prisma.watch.findMany({
    where: { productId: ctx.productId, isActive: true },
  });

  let sent = 0;
  for (const watch of watches) {
    // null maxPrice means "at or below MSRP" — the default promise of the site.
    const ceiling = watch.maxPriceCents ?? ctx.msrpCents;
    if (ctx.priceCents == null || ctx.priceCents > ceiling) continue;

    const result = await deliver(ctx);
    try {
      await prisma.alert.create({
        data: {
          watchId: watch.id,
          stockEventId: ctx.stockEventId,
          channel: result.channel,
          ok: result.ok,
          error: result.error,
        },
      });
      await prisma.watch.update({
        where: { id: watch.id },
        data: { lastNotifiedAt: new Date() },
      });
      sent += 1;
    } catch {
      // Unique constraint: this watch was already told about this event.
    }
  }
  return sent;
}
