import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOwnedRestaurant } from "@/lib/business";

const schema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  price: z.number().positive().max(1000),
  menuSection: z.string().min(1).max(50),
  image: z.string().url().optional().or(z.literal("")),
});

export async function POST(
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

  const { name, description, price, menuSection, image } = parsed.data;
  const item = await prisma.menuItem.create({
    data: {
      name,
      description: description || null,
      price,
      menuSection,
      image: image || null,
      restaurantId: restaurant.id,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
