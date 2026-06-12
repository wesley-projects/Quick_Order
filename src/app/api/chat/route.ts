import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(40),
});

const SYSTEM_PROMPT = `You are the OrangeOrder support assistant, embedded in the OrangeOrder food delivery website.

Rules:
- Only help with OrangeOrder topics: the user's orders and their status, delivery estimates, restaurants, menus, and how the site works.
- Use the get_my_orders tool to answer any question about the user's orders. Never invent order details.
- Order statuses mean: PENDING = waiting for the restaurant to confirm, CONFIRMED = restaurant accepted it, PREPARING = food is being made, OUT_FOR_DELIVERY = on its way, DELIVERED = completed, CANCELLED = cancelled.
- For refunds or complaints about food quality, apologize and suggest the user contact the restaurant directly.
- Be friendly and concise — a couple of sentences is usually enough.
- If asked about anything unrelated to OrangeOrder, politely steer back.`;

const tools: Anthropic.Tool[] = [
  {
    name: "get_my_orders",
    description:
      "Get the signed-in user's recent orders with status, items, restaurant, and delivery details. Call this whenever the user asks about their order, where it is, or what they ordered.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_restaurant_info",
    description:
      "Look up a restaurant on OrangeOrder by (partial) name: whether it is open, delivery time and fee, rating, and menu items.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Restaurant name to search for" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
];

async function runTool(name: string, input: unknown, userId: string): Promise<string> {
  if (name === "get_my_orders") {
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        restaurant: { select: { name: true, deliveryTime: true } },
        items: { include: { menuItem: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (orders.length === 0) return "The user has no orders yet.";
    return JSON.stringify(
      orders.map((o) => ({
        orderNumber: o.id.slice(-6),
        restaurant: o.restaurant.name,
        status: o.status,
        placedAt: o.createdAt.toISOString(),
        estimatedDeliveryMinutes: o.restaurant.deliveryTime,
        deliveryAddress: o.deliveryAddress,
        total: o.total,
        items: o.items.map((i) => `${i.quantity}x ${i.menuItem.name}`),
      }))
    );
  }

  if (name === "get_restaurant_info") {
    const { name: query } = (input ?? {}) as { name?: string };
    if (!query) return "No restaurant name provided.";
    const restaurants = await prisma.restaurant.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      include: {
        category: { select: { name: true } },
        menuItems: {
          where: { isAvailable: true },
          select: { name: true, price: true, menuSection: true },
        },
      },
      take: 3,
    });
    if (restaurants.length === 0) return `No restaurant found matching "${query}".`;
    return JSON.stringify(
      restaurants.map((r) => ({
        name: r.name,
        category: r.category.name,
        isOpen: r.isOpen,
        rating: r.rating,
        deliveryTimeMinutes: r.deliveryTime,
        deliveryFee: r.deliveryFee,
        menu: r.menuItems.map((m) => `${m.name} (${m.menuSection}) — $${m.price}`),
      }))
    );
  }

  return `Unknown tool: ${name}`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Chat is not configured. Set ANTHROPIC_API_KEY to enable it." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;
  const client = new Anthropic();

  const messages: Anthropic.MessageParam[] = parsed.data.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    // Agentic loop: let Claude call tools until it produces a final answer.
    for (let i = 0; i < 5; i++) {
      const response = await client.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        return NextResponse.json({ reply: text });
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await runTool(block.name, block.input, userId);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }

    return NextResponse.json({
      reply: "Sorry, I couldn't finish answering that. Please try rephrasing.",
    });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json(
      { error: "Something went wrong talking to the assistant." },
      { status: 500 }
    );
  }
}
