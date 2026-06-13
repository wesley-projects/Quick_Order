import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOwnedRestaurant } from "@/lib/business";
import { stripe } from "@/lib/stripe";

const schema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const restaurant = await getOwnedRestaurant(order.restaurantId);
  if (!restaurant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Refund a real card payment when the order is cancelled (and wasn't already).
  const isNewlyCancelled =
    parsed.data.status === "CANCELLED" && order.status !== "CANCELLED";
  const hasRealPayment = order.stripePaymentId?.startsWith("pi_") ?? false;

  if (isNewlyCancelled && hasRealPayment && stripe) {
    try {
      await stripe.refunds.create({ payment_intent: order.stripePaymentId! });
    } catch (err) {
      console.error("Refund failed:", err);
      return NextResponse.json(
        { error: "Could not refund the customer's payment. Order not cancelled." },
        { status: 502 }
      );
    }
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: parsed.data.status },
  });
  return NextResponse.json({ id: updated.id, status: updated.status });
}
