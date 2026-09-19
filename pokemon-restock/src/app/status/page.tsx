import { prisma } from "@/lib/prisma";
import { listAdapters, isDemoMode } from "@/lib/checker/registry";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monitor — RestockRadar" };

export default async function StatusPage() {
  const [retailers, recentChecks, totals, lastCheck] = await Promise.all([
    prisma.retailer.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { listings: true } } },
    }),
    prisma.checkRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { ok: true, durationMs: true, error: true, createdAt: true },
    }),
    prisma.checkRun.count(),
    prisma.checkRun.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  const adapters = listAdapters();
  const failures = recentChecks.filter((c) => !c.ok);
  const avgMs =
    recentChecks.length > 0
      ? Math.round(recentChecks.reduce((n, c) => n + c.durationMs, 0) / recentChecks.length)
      : 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">Monitor</h1>
        <p className="mt-1 text-sm text-slate-400">
          What the checker is doing, and which retailer adapters are actually wired up.
        </p>
      </header>

      {isDemoMode() && (
        <div className="rounded-xl border border-bolt-500/40 bg-bolt-500/[0.07] px-4 py-3 text-sm text-bolt-400">
          <strong className="font-semibold">Demo mode is on.</strong>{" "}
          <span className="text-slate-300">
            Every retailer is being checked by the simulator, so prices and stock states on this
            site are generated, not real. Set <code>DEMO_MODE=false</code> to use the real
            adapters below.
          </span>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Checks recorded" value={totals.toLocaleString()} />
        <Stat label="Last check" value={timeAgo(lastCheck?.createdAt ?? null)} />
        <Stat label="Avg duration" value={`${avgMs}ms`} />
        <Stat
          label="Failures (last 200)"
          value={String(failures.length)}
          tone={failures.length > 0 ? "bad" : "good"}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Adapters</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-ink-700/70">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Adapter</th>
                <th className="px-4 py-2.5 font-medium">State</th>
                <th className="px-4 py-2.5 font-medium">How to enable it</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800 bg-ink-900/40">
              {adapters.map((adapter) => (
                <tr key={adapter.key}>
                  <td className="px-4 py-3 font-medium text-slate-200">{adapter.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${
                        adapter.isConfigured()
                          ? "bg-mint-500/15 text-mint-400 ring-mint-500/30"
                          : "bg-ink-700/60 text-slate-400 ring-ink-600"
                      }`}
                    >
                      {adapter.isConfigured() ? "Ready" : "Not configured"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs leading-relaxed text-slate-500">
                    {adapter.configHint}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Retailers</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-ink-700/70">
          <table className="w-full text-sm">
            <thead className="bg-ink-900/80 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Retailer</th>
                <th className="px-4 py-2.5 font-medium">Adapter key</th>
                <th className="px-4 py-2.5 font-medium">Listings</th>
                <th className="px-4 py-2.5 font-medium">Min interval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800 bg-ink-900/40">
              {retailers.map((retailer) => (
                <tr key={retailer.id}>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-medium text-slate-200">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: retailer.accent }}
                        aria-hidden
                      />
                      {retailer.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {retailer.adapterKey}
                  </td>
                  <td className="px-4 py-3 tabular text-slate-400">
                    {retailer._count.listings}
                  </td>
                  <td className="px-4 py-3 tabular text-slate-400">
                    {retailer.minIntervalSec}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {failures.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white">Recent failures</h2>
          <ul className="mt-3 space-y-1.5">
            {failures.slice(0, 10).map((failure, i) => (
              <li
                key={i}
                className="rounded-lg border border-ember-500/25 bg-ember-500/[0.06] px-3 py-2 font-mono text-xs text-ember-400"
              >
                <span className="text-slate-500">{timeAgo(failure.createdAt)} · </span>
                {failure.error}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-900/60 px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={`mt-1 text-xl font-bold tabular ${
          tone === "bad" ? "text-ember-400" : tone === "good" ? "text-mint-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
