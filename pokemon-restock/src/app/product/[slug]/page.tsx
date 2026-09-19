import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getProduct, getProductEvents } from "@/lib/board";
import { STOCK_STATUS } from "@/lib/constants";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { StatusPill, RetailBadge } from "@/components/StatusPill";
import { PriceTag } from "@/components/PriceTag";
import { EventRow } from "@/components/EventRow";
import { WatchForm } from "@/components/WatchForm";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await getProduct(params.slug);
  if (!product) return { title: "Not found — RestockRadar" };
  return {
    title: `${product.name} — restock tracker`,
    description: `Live retail availability for ${product.name}. MSRP ${formatCurrency(product.msrpCents)}.`,
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  const events = await getProductEvents(product.id, 25);
  const cheapestAtRetail = product.offers.find((o) => o.atRetail);

  return (
    <div className="space-y-8">
      <nav className="text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-300">
          Board
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-slate-400">{product.setName}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            {product.setName} · {product.kindLabel}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {product.name}
          </h1>
          {product.description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              {product.description}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-ink-700/70 bg-ink-900/60 px-4 py-3 text-right">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">MSRP</p>
          <p className="mt-0.5 text-2xl font-bold tabular text-white">
            {formatCurrency(product.msrpCents)}
          </p>
        </div>
      </header>

      <section
        className={[
          "rounded-xl border px-4 py-4",
          cheapestAtRetail
            ? "border-bolt-500/50 bg-bolt-500/[0.07]"
            : "border-ink-700/70 bg-ink-900/50",
        ].join(" ")}
      >
        {cheapestAtRetail ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-bolt-400">
                Available at retail right now
              </p>
              <p className="mt-0.5 text-sm text-slate-300">
                {cheapestAtRetail.retailerName} ·{" "}
                <PriceTag
                  priceCents={cheapestAtRetail.priceCents}
                  msrpCents={product.msrpCents}
                  markupPercent={cheapestAtRetail.markupPercent}
                  size="sm"
                />
              </p>
            </div>
            <a
              href={cheapestAtRetail.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded-lg bg-bolt-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-bolt-400"
            >
              Go to {cheapestAtRetail.retailerName} →
            </a>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Nothing at or below MSRP right now.{" "}
            {product.inStockCount > 0
              ? "Everything in stock is above retail — the table below shows by how much."
              : "No tracked retailer has stock. Set an alert and we will tell you when that changes."}
          </p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Retailers</h2>
          <AutoRefresh seconds={30} />
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-ink-700/70">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Retailer</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Price</th>
                <th className="px-4 py-2.5 font-medium">Last in stock</th>
                <th className="px-4 py-2.5 font-medium">Checked</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800 bg-ink-900/40">
              {product.offers.map((offer) => (
                <tr key={offer.listingId} className="hover:bg-ink-800/40">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-medium text-slate-200">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: offer.accent }}
                        aria-hidden
                      />
                      {offer.retailerName}
                    </span>
                    {!offer.adapterConfigured && (
                      <span className="ml-2 text-[11px] text-slate-600">adapter not configured</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={offer.status} pulse />
                  </td>
                  <td className="px-4 py-3">
                    <PriceTag
                      priceCents={offer.priceCents}
                      msrpCents={product.msrpCents}
                      markupPercent={offer.markupPercent}
                      size="sm"
                      subdued={offer.status !== STOCK_STATUS.IN_STOCK}
                    />
                    {offer.status === STOCK_STATUS.IN_STOCK && offer.priceCents != null && (
                      <RetailBadge atRetail={offer.atRetail} className="ml-2" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{timeAgo(offer.lastInStockAt)}</td>
                  <td className="px-4 py-3 text-slate-500">{timeAgo(offer.lastCheckedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={offer.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-xs font-semibold text-bolt-500 hover:underline"
                    >
                      Open →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section>
          <h2 className="text-lg font-semibold text-white">History</h2>
          {events.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-slate-500">
              No stock changes recorded yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-ink-800 overflow-hidden rounded-xl border border-ink-700/70 bg-ink-900/50">
              {events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </section>

        <aside className="lg:pt-9">
          <WatchForm
            productId={product.id}
            productName={product.name}
            msrpCents={product.msrpCents}
          />
        </aside>
      </div>
    </div>
  );
}
