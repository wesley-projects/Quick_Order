import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function PriceTag({
  priceCents,
  msrpCents,
  markupPercent,
  size = "md",
  subdued = false,
}: {
  priceCents: number | null;
  msrpCents: number;
  markupPercent: number | null;
  size?: "sm" | "md" | "lg";
  /** The price is a last-known value, not something you can buy right now. */
  subdued?: boolean;
}) {
  const atRetail = priceCents != null && priceCents <= msrpCents;
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular">
      <span
        className={cn(
          "font-bold",
          size === "lg" && "text-2xl",
          size === "md" && "text-lg",
          size === "sm" && "text-sm",
          priceCents == null || subdued
            ? "text-slate-500"
            : atRetail
              ? "text-mint-400"
              : "text-slate-100",
        )}
      >
        {formatCurrency(priceCents)}
      </span>
      {!subdued && markupPercent != null && markupPercent !== 0 && (
        <span
          className={cn(
            "text-xs font-semibold",
            markupPercent > 0 ? "text-ember-400" : "text-mint-400",
          )}
        >
          {markupPercent > 0 ? "+" : ""}
          {markupPercent}%
        </span>
      )}
    </span>
  );
}
