import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runChecks } from "@/lib/checker/runner";

export const dynamic = "force-dynamic";
/** A full cycle can outlast the default serverless budget. */
export const maxDuration = 60;

/**
 * The polling entry point. Point a cron at it:
 *
 *   curl -X POST https://your-host/api/cron/check \
 *     -H "authorization: Bearer $CRON_SECRET"
 *
 * On Vercel, vercel.json schedules it and the platform sends the header for
 * you. Anywhere else, any scheduler that can send a header will do.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // No secret configured means local development. Refuse in production
  // rather than leaving an open endpoint that anyone can use to make us
  // hammer retailers.
  if (!secret) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  try {
    const summary = await runChecks({ force });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

/** Vercel Cron issues GETs; accept both so either scheduler works. */
export const GET = POST;
