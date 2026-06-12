import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional(),
  categoryId: z.string(),
  deliveryTime: z.number().int().min(5).max(120),
  deliveryFee: z.number().min(0).max(20),
  image: z.string().url().optional().or(z.literal("")),
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

  const { name, description, categoryId, deliveryTime, deliveryFee, image } =
    parsed.data;
  const userId = (session.user as { id: string }).id;

  const category = await prisma.foodCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  let slug = slugify(name);
  if (await prisma.restaurant.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name,
      slug,
      description: description || null,
      image: image || null,
      categoryId,
      deliveryTime,
      deliveryFee,
      ownerId: userId,
    },
  });

  return NextResponse.json({ id: restaurant.id, slug: restaurant.slug }, { status: 201 });
}
