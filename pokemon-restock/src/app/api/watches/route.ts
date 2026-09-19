import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

const CreateWatch = z.object({
  productId: z.string().min(1),
  email: z.email(),
  /** null means "alert me at or below MSRP", which is the default promise. */
  maxPriceDollars: z.number().positive().max(100_000).nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = CreateWatch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { productId, email, maxPriceDollars } = parsed.data;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ error: "That product no longer exists." }, { status: 404 });
  }

  const maxPriceCents =
    maxPriceDollars == null ? null : Math.round(maxPriceDollars * 100);
  const ceiling = maxPriceCents ?? product.msrpCents;

  // Upsert rather than insert: re-subscribing should update your ceiling and
  // re-activate a watch you previously unsubscribed from, not 409.
  const watch = await prisma.watch.upsert({
    where: { email_productId: { email: email.toLowerCase(), productId } },
    create: {
      email: email.toLowerCase(),
      productId,
      maxPriceCents,
      token: randomBytes(24).toString("hex"),
    },
    update: { maxPriceCents, isActive: true },
  });

  return NextResponse.json({
    ok: true,
    message: `Watching. You will hear from us when it is in stock at or below ${formatCurrency(ceiling)}.`,
    unsubscribeUrl: `/watch/${watch.token}`,
  });
}
