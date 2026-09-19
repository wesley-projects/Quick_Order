import { STOCK_STATUS, STOCK_STATUS_LABEL, type StockStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STYLES: Record<StockStatus, string> = {
  IN_STOCK: "bg-mint-500/15 text-mint-400 ring-mint-500/30",
  PREORDER: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  OUT_OF_STOCK: "bg-ink-700/60 text-slate-400 ring-ink-600",
  UNKNOWN: "bg-ink-700/40 text-slate-500 ring-ink-600",
};

export function StatusPill({
  status,
  className,
  pulse = false,
}: {
  status: StockStatus;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        STYLES[status] ?? STYLES.UNKNOWN,
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current",
          pulse && status === STOCK_STATUS.IN_STOCK && "animate-pulseRing",
        )}
      />
      {STOCK_STATUS_LABEL[status] ?? "Unknown"}
    </span>
  );
}

/** The verdict the site exists for: is this price a retail price? */
export function RetailBadge({ atRetail, className }: { atRetail: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset",
        atRetail
          ? "bg-bolt-500/15 text-bolt-400 ring-bolt-500/40"
          : "bg-ember-500/10 text-ember-400 ring-ember-500/30",
        className,
      )}
    >
      {atRetail ? "At retail" : "Over MSRP"}
    </span>
  );
}
