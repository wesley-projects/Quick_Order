"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { PRODUCT_KIND_LABEL, type ProductKind } from "@/lib/constants";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "relevance", label: "Best first" },
  { value: "price", label: "Price" },
  { value: "msrp", label: "MSRP" },
  { value: "name", label: "Name" },
];

export function BoardFilters({ sets, kinds }: { sets: string[]; kinds: ProductKind[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  const toggle = (key: string) => update(key, params.get(key) === "1" ? null : "1");
  const selectClass =
    "rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-sm text-slate-300 outline-none focus:border-bolt-500";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 transition-opacity",
        isPending && "opacity-60",
      )}
    >
      <input
        type="search"
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => update("q", e.target.value)}
        placeholder="Search products or sets…"
        aria-label="Search products"
        className="min-w-[13rem] flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-bolt-500"
      />

      <button
        type="button"
        onClick={() => toggle("atRetail")}
        aria-pressed={params.get("atRetail") === "1"}
        className={cn(
          "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
          params.get("atRetail") === "1"
            ? "border-bolt-500 bg-bolt-500/15 text-bolt-400"
            : "border-ink-700 bg-ink-900 text-slate-400 hover:text-slate-200",
        )}
      >
        At retail only
      </button>

      <button
        type="button"
        onClick={() => toggle("inStock")}
        aria-pressed={params.get("inStock") === "1"}
        className={cn(
          "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
          params.get("inStock") === "1"
            ? "border-mint-500 bg-mint-500/15 text-mint-400"
            : "border-ink-700 bg-ink-900 text-slate-400 hover:text-slate-200",
        )}
      >
        In stock only
      </button>

      <select
        aria-label="Filter by set"
        value={params.get("set") ?? ""}
        onChange={(e) => update("set", e.target.value)}
        className={selectClass}
      >
        <option value="">All sets</option>
        {sets.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by product type"
        value={params.get("kind") ?? ""}
        onChange={(e) => update("kind", e.target.value)}
        className={selectClass}
      >
        <option value="">All types</option>
        {kinds.map((k) => (
          <option key={k} value={k}>
            {PRODUCT_KIND_LABEL[k]}
          </option>
        ))}
      </select>

      <select
        aria-label="Sort products"
        value={params.get("sort") ?? "relevance"}
        onChange={(e) => update("sort", e.target.value)}
        className={selectClass}
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            Sort: {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
