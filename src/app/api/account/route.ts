import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email("Enter a valid email").optional(),
  phone: z
    .string()
    .regex(/^[\d\s()+-]{7,20}$/, "Enter a valid phone number")
    .or(z.literal(""))
    .optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const userId = (session.user as { id: string }).id;
  const { email, phone } = parsed.data;

  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      return NextResponse.json(
        { error: "That email is already in use" },
        { status: 409 }
      );
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone: phone || null }),
    },
    select: { email: true, phone: true },
  });

  return NextResponse.json(user);
}
