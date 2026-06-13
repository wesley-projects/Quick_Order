import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOwnedRestaurant } from "@/lib/business";

const schema = z.object({
  deliveryFee: z.number().min(0).max(50),
  deliveryTime: z.number().int().min(5).max(180),
  isOpen: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const restaurant = await getOwnedRestaurant(id);
  if (!restaurant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.restaurant.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({
    deliveryFee: updated.deliveryFee,
    deliveryTime: updated.deliveryTime,
    isOpen: updated.isOpen,
  });
}
