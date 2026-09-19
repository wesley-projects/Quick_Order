import { NextResponse } from "next/server";
import { getBoard } from "@/lib/board";

export const dynamic = "force-dynamic";

/** JSON view of the board, for anything that would rather poll than scrape. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const products = await getBoard({
    q: params.get("q") ?? undefined,
    kind: params.get("kind") ?? undefined,
    set: params.get("set") ?? undefined,
    inStockOnly: params.get("inStock") === "1",
    atRetailOnly: params.get("atRetail") === "1",
    sort: (params.get("sort") as "price" | "msrp" | "name" | "relevance") ?? "relevance",
  });
  return NextResponse.json({ count: products.length, products });
}
