import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * The judgement the whole site exists to make: is this a retail price?
 * A listing at exactly MSRP counts — "at or below" is the promise.
 */
export function isAtRetail(priceCents: number | null | undefined, msrpCents: number): boolean {
  if (priceCents == null) return false;
  return priceCents <= msrpCents;
}

/**
 * Markup over MSRP as a percentage, rounded. Negative means below retail.
 * Returns null when there is no price to compare.
 */
export function markupPercent(
  priceCents: number | null | undefined,
  msrpCents: number,
): number | null {
  if (priceCents == null || msrpCents <= 0) return null;
  return Math.round(((priceCents - msrpCents) / msrpCents) * 100);
}

/** "3m ago", "2h ago", "just now" — compact enough for a dense table. */
export function timeAgo(date: Date | string | null | undefined, now: Date = new Date()): string {
  if (!date) return "never";
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
