"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

type State = { kind: "idle" } | { kind: "saving" } | { kind: "ok"; message: string } | { kind: "error"; message: string };

export function WatchForm({
  productId,
  productName,
  msrpCents,
}: {
  productId: string;
  productName: string;
  msrpCents: number;
}) {
  const [email, setEmail] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "saving" });
    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          email,
          maxPriceDollars: maxPrice === "" ? null : Number(maxPrice),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: body.error ?? "Could not save that watch." });
        return;
      }
      setState({ kind: "ok", message: body.message });
      setEmail("");
      setMaxPrice("");
    } catch {
      setState({ kind: "error", message: "Network error — try again." });
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-ink-700/70 bg-ink-900/60 p-4">
      <h3 className="text-sm font-semibold text-white">Alert me on a restock</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        We will notify you when {productName} is in stock at or below{" "}
        <strong className="text-slate-300">{formatCurrency(msrpCents)}</strong>. Set your own
        ceiling if you are willing to pay over MSRP.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="min-w-[12rem] flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-bolt-500"
        />
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            $
          </span>
          <input
            type="number"
            min="1"
            step="0.01"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder={(msrpCents / 100).toFixed(2)}
            aria-label="Maximum price in dollars"
            className="w-28 rounded-lg border border-ink-700 bg-ink-950 py-2 pl-7 pr-3 text-sm tabular text-slate-200 placeholder:text-slate-600 outline-none focus:border-bolt-500"
          />
        </div>
        <button
          type="submit"
          disabled={state.kind === "saving"}
          className="rounded-lg bg-bolt-500 px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-bolt-400 disabled:opacity-60"
        >
          {state.kind === "saving" ? "Saving…" : "Watch"}
        </button>
      </div>

      {state.kind === "ok" && <p className="mt-2 text-xs text-mint-400">{state.message}</p>}
      {state.kind === "error" && <p className="mt-2 text-xs text-ember-400">{state.message}</p>}
    </form>
  );
}
