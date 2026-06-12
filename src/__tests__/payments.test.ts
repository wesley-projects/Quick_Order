import { DELIVERY_FEE, calculateOrderAmountCents, toCents } from "@/lib/payments";

describe("toCents", () => {
  it("converts dollars to integer cents", () => {
    expect(toCents(10.99)).toBe(1099);
    expect(toCents(0)).toBe(0);
  });

  it("rounds float drift instead of truncating", () => {
    // 19.99 * 3 = 59.97 but floats give 59.969999...; cents must still be exact
    expect(toCents(19.99 * 3)).toBe(5997);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
});

describe("calculateOrderAmountCents", () => {
  it("charges item subtotal plus delivery fee", () => {
    const amount = calculateOrderAmountCents([{ price: 10.99, quantity: 2 }]);
    expect(amount).toBe(toCents(21.98 + DELIVERY_FEE));
  });

  it("sums multiple items", () => {
    const amount = calculateOrderAmountCents([
      { price: 13.99, quantity: 1 },
      { price: 3.99, quantity: 2 },
    ]);
    expect(amount).toBe(toCents(21.97 + DELIVERY_FEE));
  });

  it("produces integer cents even with float-unfriendly prices", () => {
    const amount = calculateOrderAmountCents([{ price: 19.99, quantity: 3 }]);
    expect(Number.isInteger(amount)).toBe(true);
    expect(amount).toBe(5997 + toCents(DELIVERY_FEE));
  });
});
