import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { calculateOrderAmountCents } from "@/lib/payments";

const schema = z.object({
  restaurantId: z.string(),
  deliveryAddress: z.string().min(5),
  items: z.array(
    z.object({
      menuItemId: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
    })
  ).min(1),
  stripePaymentId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { restaurantId, deliveryAddress, items, stripePaymentId } = parsed.data;
  const userId = (session.user as { id: string }).id;

  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  // When Stripe is configured, only accept orders backed by a real, succeeded
  // PaymentIntent that belongs to this user, charged the right amount, and
  // hasn't already been consumed by another order.
  const stripe = getStripe();
  if (stripe) {
    if (!stripePaymentId || stripePaymentId === "MOCK") {
      return NextResponse.json({ error: "Payment required" }, { status: 402 });
    }

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentId);
    } catch {
      return NextResponse.json({ error: "Invalid payment" }, { status: 402 });
    }

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
    }
    if (paymentIntent.metadata.userId !== userId) {
      return NextResponse.json({ error: "Payment does not belong to this user" }, { status: 403 });
    }

    const expectedAmount = calculateOrderAmountCents(
      items.map((i) => ({ price: i.unitPrice, quantity: i.quantity }))
    );
    if (paymentIntent.amount !== expectedAmount) {
      return NextResponse.json({ error: "Payment amount mismatch" }, { status: 400 });
    }

    const existing = await prisma.order.findFirst({
      where: { stripePaymentId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Payment already used" }, { status: 409 });
    }
  }

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId,
        restaurantId,
        deliveryAddress,
        total,
        stripePaymentId: stripePaymentId ?? "MOCK",
        status: "CONFIRMED",
        items: {
          create: items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
    });

    await tx.cartItem.deleteMany({ where: { userId } });

    return newOrder;
  });

  return NextResponse.json({ orderId: order.id }, { status: 201 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      restaurant: { select: { name: true, slug: true } },
      items: { include: { menuItem: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}
