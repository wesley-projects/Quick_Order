import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/checker/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [products, listings, lastCheck] = await Promise.all([
      prisma.product.count(),
      prisma.listing.count(),
      prisma.checkRun.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);
    return NextResponse.json({
      ok: true,
      demoMode: isDemoMode(),
      products,
      listings,
      lastCheckAt: lastCheck?.createdAt ?? null,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}
