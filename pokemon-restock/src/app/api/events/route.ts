import { NextResponse } from "next/server";
import { getRecentEvents } from "@/lib/board";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Number(params.get("limit") ?? 50) || 50, 200);
  const events = await getRecentEvents(limit, params.get("atRetail") === "1");
  return NextResponse.json({ count: events.length, events });
}
