import Stripe from "stripe";

let stripe: Stripe | null = null;

/** Server-side Stripe client. Returns null when STRIPE_SECRET_KEY is unset (mock mode). */
export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}
