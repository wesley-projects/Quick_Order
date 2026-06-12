// Shared payment math. Safe to import from Client Components — no Stripe SDK here.

export const DELIVERY_FEE = 1.99;

/** Stripe amounts are integer cents; round to avoid float drift (e.g. 19.99 * 3). */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Total charge in cents for a cart: item subtotal plus delivery fee. */
export function calculateOrderAmountCents(
  items: { price: number; quantity: number }[]
): number {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return toCents(subtotal + DELIVERY_FEE);
}
