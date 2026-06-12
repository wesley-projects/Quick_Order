/**
 * Unit tests for orders API business logic.
 * We test the validation schema and total calculation independently of Next.js/Prisma.
 */

import { z } from "zod";

const orderSchema = z.object({
  restaurantId: z.string(),
  deliveryAddress: z.string().min(5),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
      })
    )
    .min(1),
  stripePaymentId: z.string().optional(),
});

function computeTotal(items: { quantity: number; unitPrice: number }[]): number {
  return items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
}

describe("Order schema validation", () => {
  const validOrder = {
    restaurantId: "rest-1",
    deliveryAddress: "123 Main Street",
    items: [{ menuItemId: "item-1", quantity: 2, unitPrice: 10.99 }],
  };

  it("accepts a valid order", () => {
    expect(orderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("rejects missing restaurantId", () => {
    const rest = { ...validOrder, restaurantId: undefined };
    expect(orderSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects short delivery address", () => {
    expect(orderSchema.safeParse({ ...validOrder, deliveryAddress: "123" }).success).toBe(false);
  });

  it("rejects empty items array", () => {
    expect(orderSchema.safeParse({ ...validOrder, items: [] }).success).toBe(false);
  });

  it("rejects zero quantity", () => {
    const items = [{ menuItemId: "item-1", quantity: 0, unitPrice: 10 }];
    expect(orderSchema.safeParse({ ...validOrder, items }).success).toBe(false);
  });

  it("rejects negative unit price", () => {
    const items = [{ menuItemId: "item-1", quantity: 1, unitPrice: -5 }];
    expect(orderSchema.safeParse({ ...validOrder, items }).success).toBe(false);
  });

  it("accepts optional stripePaymentId", () => {
    const result = orderSchema.safeParse({ ...validOrder, stripePaymentId: "pi_test" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.stripePaymentId).toBe("pi_test");
  });
});

describe("Order total calculation", () => {
  it("computes single item total", () => {
    expect(computeTotal([{ quantity: 2, unitPrice: 10.99 }])).toBeCloseTo(21.98);
  });

  it("computes multiple items total", () => {
    const items = [
      { quantity: 1, unitPrice: 13.99 },
      { quantity: 2, unitPrice: 3.99 },
    ];
    expect(computeTotal(items)).toBeCloseTo(21.97);
  });

  it("returns 0 for empty items", () => {
    expect(computeTotal([])).toBe(0);
  });
});
