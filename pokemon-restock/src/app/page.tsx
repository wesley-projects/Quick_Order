import { getBoard, getFacets, getRecentEvents } from "@/lib/board";
import { ProductCard } from "@/components/ProductCard";
import { BoardFilters } from "@/components/BoardFilters";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EventRow } from "@/components/EventRow";
import Link from "next/link";
import type { BoardFilters as Filters } from "@/types";

export const dynamic = "force-dynamic";

function parseFilters(searchParams: Record<string, string | string[] | undefined>): Filters {
  const one = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return {
    q: one("q"),
    kind: one("kind"),
    set: one("set"),
    inStockOnly: one("inStock") === "1",
    atRetailOnly: one("atRetail") === "1",
    sort: (one("sort") as Filters["sort"]) ?? "relevance",
  };
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseFilters(searchParams);
  const [products, facets, events] = await Promise.all([
    getBoard(filters),
    getFacets(),
    getRecentEvents(6, true),
  ]);

  const atRetailNow = products.filter((p) => p.atRetailCount > 0);

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Pokemon TCG, at retail price
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-400">
              Every product below is checked against its MSRP. Green means someone is selling it
              at or under retail right now.
            </p>
          </div>
          <AutoRefresh seconds={30} />
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Tracked products" value={products.length} />
          <Stat
            label="At retail now"
            value={atRetailNow.length}
            accent={atRetailNow.length > 0 ? "good" : undefined}
          />
          <Stat
            label="In stock anywhere"
            value={products.filter((p) => p.inStockCount > 0).length}
          />
          <Stat label="Retailer checks" value={products.reduce((n, p) => n + p.offers.length, 0)} />
        </dl>
      </section>

      <section className="space-y-4">
        <BoardFilters sets={facets.sets} kinds={facets.kinds} />

        {products.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-700 px-4 py-10 text-center text-sm text-slate-500">
            Nothing matches those filters right now. Restocks are short — try clearing{" "}
            <em>At retail only</em>.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {events.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-white">Recent retail-price restocks</h2>
            <Link href="/restocks" className="text-sm text-bolt-500 hover:underline">
              Full feed →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-ink-800 overflow-hidden rounded-xl border border-ink-700/70 bg-ink-900/50">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "good";
}) {
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-900/60 px-3.5 py-3">
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd
        className={`mt-1 text-2xl font-bold tabular ${
          accent === "good" ? "text-bolt-400" : "text-white"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
