import { notFound } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your alert — RestockRadar" };

/**
 * Manage a single watch. The token in the URL is the only credential, which
 * is why it is 24 random bytes — it has to be safe to put in an email.
 */
export default async function WatchPage({ params }: { params: { token: string } }) {
  const watch = await prisma.watch.findUnique({
    where: { token: params.token },
    include: { product: true },
  });
  if (!watch) notFound();

  async function unsubscribe(formData: FormData) {
    "use server";
    const token = String(formData.get("token"));
    await prisma.watch.updateMany({ where: { token }, data: { isActive: false } });
    revalidatePath(`/watch/${token}`);
  }

  const ceiling = watch.maxPriceCents ?? watch.product.msrpCents;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-bold tracking-tight text-white">Your restock alert</h1>

      <div className="rounded-xl border border-ink-700/70 bg-ink-900/60 p-5 text-sm">
        <dl className="space-y-2.5">
          <Row label="Product">
            <Link href={`/product/${watch.product.slug}`} className="text-bolt-400 hover:underline">
              {watch.product.name}
            </Link>
          </Row>
          <Row label="Email">{watch.email}</Row>
          <Row label="Alert at or below">
            <span className="tabular">{formatCurrency(ceiling)}</span>
            {watch.maxPriceCents == null && (
              <span className="ml-1.5 text-xs text-slate-500">(MSRP)</span>
            )}
          </Row>
          <Row label="Status">
            {watch.isActive ? (
              <span className="text-mint-400">Active</span>
            ) : (
              <span className="text-slate-500">Unsubscribed</span>
            )}
          </Row>
          <Row label="Last notified">
            {watch.lastNotifiedAt ? watch.lastNotifiedAt.toLocaleString() : "never"}
          </Row>
        </dl>

        {watch.isActive && (
          <form action={unsubscribe} className="mt-5 border-t border-ink-700/60 pt-4">
            <input type="hidden" name="token" value={watch.token} />
            <button
              type="submit"
              className="rounded-lg border border-ember-500/40 bg-ember-500/10 px-4 py-2 text-sm font-semibold text-ember-400 transition hover:bg-ember-500/20"
            >
              Unsubscribe from this alert
            </button>
          </form>
        )}
      </div>

      <Link href="/" className="inline-block text-sm text-slate-400 hover:text-slate-200">
        ← Back to the board
      </Link>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-200">{children}</dd>
    </div>
  );
}
