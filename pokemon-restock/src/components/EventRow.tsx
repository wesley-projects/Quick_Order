import Link from "next/link";
import { EVENT_KIND } from "@/lib/constants";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { RetailBadge } from "@/components/StatusPill";
import type { EventView } from "@/types";

const KIND_LABEL: Record<string, string> = {
  RESTOCK: "Restocked",
  SOLD_OUT: "Sold out",
  PRICE_CHANGE: "Price changed",
  PREORDER_OPEN: "Preorder open",
};

const KIND_STYLE: Record<string, string> = {
  RESTOCK: "text-mint-400",
  SOLD_OUT: "text-slate-500",
  PRICE_CHANGE: "text-sky-300",
  PREORDER_OPEN: "text-bolt-400",
};

export function EventRow({ event }: { event: EventView }) {
  const isRestock = event.kind === EVENT_KIND.RESTOCK;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm hover:bg-ink-800/40">
      <span
        className={`w-24 shrink-0 text-xs font-semibold uppercase tracking-wide ${
          KIND_STYLE[event.kind] ?? "text-slate-400"
        }`}
      >
        {KIND_LABEL[event.kind] ?? event.kind}
      </span>

      <Link
        href={`/product/${event.productSlug}`}
        className="min-w-0 flex-1 truncate font-medium text-slate-200 hover:text-bolt-400"
      >
        {event.productName}
      </Link>

      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: event.accent }}
          aria-hidden
        />
        {event.retailerName}
      </span>

      <span className="tabular text-slate-300">
        {event.kind === EVENT_KIND.PRICE_CHANGE && event.prevPriceCents != null && (
          <span className="mr-1.5 text-slate-600 line-through">
            {formatCurrency(event.prevPriceCents)}
          </span>
        )}
        {formatCurrency(event.priceCents)}
      </span>

      {(isRestock || event.kind === EVENT_KIND.PRICE_CHANGE) && event.priceCents != null && (
        <RetailBadge atRetail={event.atRetail} />
      )}

      <time
        dateTime={event.createdAt}
        suppressHydrationWarning
        className="w-16 shrink-0 text-right text-xs text-slate-500"
      >
        {timeAgo(event.createdAt)}
      </time>
    </li>
  );
}
