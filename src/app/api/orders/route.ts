import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  // Mock orders are confirmed instantly. Real card orders start PENDING and are
  // promoted to CONFIRMED by the Stripe webhook once payment actually succeeds —
  // so a charge can never exist without a matching order.
  const payId = stripePaymentId ?? "MOCK";
  const status = payId === "MOCK" ? "CONFIRMED" : "PENDING";

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId,
        restaurantId,
        deliveryAddress,
        total,
        stripePaymentId: payId,
        status,
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
