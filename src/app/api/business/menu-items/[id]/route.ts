import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOwnedRestaurant } from "@/lib/business";

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional(),
  price: z.number().positive().max(1000).optional(),
  menuSection: z.string().min(1).max(50).optional(),
  isAvailable: z.boolean().optional(),
});

async function getOwnedItem(itemId: string) {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item) return null;
  const restaurant = await getOwnedRestaurant(item.restaurantId);
  return restaurant ? item : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getOwnedItem(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updated = await prisma.menuItem.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getOwnedItem(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.menuItem.delete({ where: { id } });
  } catch {
    // Item is referenced by past orders — hide it instead of deleting.
    await prisma.menuItem.update({ where: { id }, data: { isAvailable: false } });
    return NextResponse.json({ hidden: true });
  }
  return NextResponse.json({ deleted: true });
}
