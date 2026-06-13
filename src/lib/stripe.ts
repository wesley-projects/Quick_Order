import Stripe from "stripe";

// Server-side Stripe client. Null when STRIPE_SECRET_KEY is unset, so the app
// keeps working in mock mode (no real charges) for local dev and demos.
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const isStripeEnabled = Boolean(process.env.STRIPE_SECRET_KEY);
