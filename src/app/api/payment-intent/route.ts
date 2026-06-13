import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const DELIVERY_FEE = 1.99;

const schema = z.object({
  restaurantId: z.string(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { restaurantId, items } = parsed.data;
  const userId = (session.user as { id: string }).id;

  // Recompute the amount server-side from DB prices — never trust the client.
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) }, restaurantId },
    select: { id: true, price: true },
  });
  const priceById = new Map(menuItems.map((m) => [m.id, Number(m.price)]));

  let subtotal = 0;
  for (const i of items) {
    const price = priceById.get(i.menuItemId);
    if (price === undefined) {
      return NextResponse.json(
        { error: "One or more items are no longer available." },
        { status: 400 }
      );
    }
    subtotal += price * i.quantity;
  }
  const total = subtotal + DELIVERY_FEE;
  const amountCents = Math.round(total * 100);

  // No Stripe key configured → tell the client to fall back to mock checkout.
  if (!stripe) {
    return NextResponse.json({ mock: true, amount: total });
  }

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: { userId, restaurantId },
  });

  return NextResponse.json({ clientSecret: intent.client_secret, amount: total });
}
