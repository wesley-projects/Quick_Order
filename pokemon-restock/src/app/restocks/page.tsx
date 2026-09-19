import Link from "next/link";
import { getRecentEvents } from "@/lib/board";
import { EventRow } from "@/components/EventRow";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Restock feed — RestockRadar" };

export default async function RestocksPage({
  searchParams,
}: {
  searchParams: { atRetail?: string };
}) {
  const atRetailOnly = searchParams.atRetail === "1";
  const events = await getRecentEvents(120, atRetailOnly);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Restock feed</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every stock and price change the monitor has recorded, newest first.
          </p>
        </div>
        <AutoRefresh seconds={30} />
      </div>

      <div className="flex gap-2">
        <Link
          href="/restocks"
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            atRetailOnly
              ? "border-ink-700 bg-ink-900 text-slate-400 hover:text-slate-200"
              : "border-bolt-500 bg-bolt-500/15 text-bolt-400"
          }`}
        >
          All events
        </Link>
        <Link
          href="/restocks?atRetail=1"
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            atRetailOnly
              ? "border-bolt-500 bg-bolt-500/15 text-bolt-400"
              : "border-ink-700 bg-ink-900 text-slate-400 hover:text-slate-200"
          }`}
        >
          At retail only
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-4 py-12 text-center text-sm text-slate-500">
          No events yet. Run <code className="text-slate-400">npm run check</code> to poll the
          retailers.
        </p>
      ) : (
        <ul className="divide-y divide-ink-800 overflow-hidden rounded-xl border border-ink-700/70 bg-ink-900/50">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </ul>
      )}
    </div>
  );
}
