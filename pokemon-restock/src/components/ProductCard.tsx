import Link from "next/link";
import { STOCK_STATUS } from "@/lib/constants";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { StatusPill, RetailBadge } from "@/components/StatusPill";
import { PriceTag } from "@/components/PriceTag";
import type { ProductView } from "@/types";

export function ProductCard({ product }: { product: ProductView }) {
  const best = product.bestOffer;
  const live = product.inStockCount > 0;

  return (
    <article
      className={[
        "group relative flex flex-col rounded-xl border bg-ink-900/70 p-4 transition",
        product.atRetailCount > 0
          ? "border-bolt-500/45 shadow-[0_0_0_1px_rgba(247,201,72,0.12)]"
          : "border-ink-700/70 hover:border-ink-600",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            {product.setName} · {product.kindLabel}
          </p>
          <h3 className="mt-1 text-[15px] font-semibold leading-snug text-white">
            <Link href={`/product/${product.slug}`} className="hover:text-bolt-400">
              <span className="absolute inset-0" aria-hidden />
              {product.name}
            </Link>
          </h3>
        </div>
        <StatusPill
          status={live ? STOCK_STATUS.IN_STOCK : (best?.status ?? STOCK_STATUS.OUT_OF_STOCK)}
          pulse
        />
      </div>

      <dl className="mt-4 flex items-end justify-between gap-3">
        <div>
          <dt className="text-[11px] uppercase tracking-wider text-slate-500">
            {live ? "Best in-stock price" : "Last seen"}
          </dt>
          <dd className="mt-0.5">
            <PriceTag
              priceCents={best?.priceCents ?? null}
              msrpCents={product.msrpCents}
              markupPercent={best?.markupPercent ?? null}
              subdued={!live}
            />
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-[11px] uppercase tracking-wider text-slate-500">MSRP</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular text-slate-300">
            {formatCurrency(product.msrpCents)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700/60 pt-3">
        {product.atRetailCount > 0 ? (
          <RetailBadge atRetail />
        ) : live ? (
          <RetailBadge atRetail={false} />
        ) : null}
        <span className="text-xs text-slate-500">
          {live
            ? `${product.inStockCount} of ${product.offers.length} retailers`
            : best?.lastInStockAt
              ? `last in stock ${timeAgo(best.lastInStockAt)}`
              : "no restock seen yet"}
        </span>
        {best && (
          <span className="ml-auto text-xs text-slate-500">
            checked {timeAgo(best.lastCheckedAt)}
          </span>
        )}
      </div>
    </article>
  );
}
