import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { calculateOrderAmountCents } from "@/lib/payments";

const schema = z.object({
  restaurantId: z.string(),
  items: z.array(
    z.object({
      menuItemId: z.string(),
      quantity: z.number().int().positive().max(99),
    })
  ).min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { restaurantId, items } = parsed.data;
  const userId = (session.user as { id: string }).id;

  // Price from the database — the client never dictates what gets charged.
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: items.map((i) => i.menuItemId) },
      restaurantId,
      isAvailable: true,
    },
    select: { id: true, price: true },
  });

  const priceById = new Map(menuItems.map((m) => [m.id, m.price]));
  if (items.some((i) => !priceById.has(i.menuItemId))) {
    return NextResponse.json(
      { error: "Some items are no longer available" },
      { status: 400 }
    );
  }

  const amount = calculateOrderAmountCents(
    items.map((i) => ({ price: priceById.get(i.menuItemId)!, quantity: i.quantity }))
  );

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency: "usd",
    // Card-style methods only; redirect-based methods would need a return_url
    // flow that can rebuild the order after navigation.
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { userId, restaurantId },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
