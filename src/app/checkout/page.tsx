"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useCart } from "@/context/CartContext";
import { formatCurrency } from "@/lib/utils";
import { DELIVERY_FEE } from "@/lib/payments";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const schema = z.object({
  address: z.string().min(10, "Enter a full delivery address"),
  name: z.string().min(2, "Enter your name"),
  phone: z.string().min(7, "Enter a valid phone number"),
});
type FormData = z.infer<typeof schema>;

export default function CheckoutPage() {
  const router = useRouter();
  const { status } = useSession();
  const { items, restaurantId } = useCart();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentError, setIntentError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/checkout");
    }
  }, [status, router]);

  // Create (or re-create) the PaymentIntent whenever the cart changes so the
  // charged amount always matches what's on screen.
  const cartKey = JSON.stringify(
    items.map((i) => [i.menuItemId, i.quantity])
  );
  useEffect(() => {
    if (!stripePromise || status !== "authenticated" || items.length === 0) return;

    let cancelled = false;
    setClientSecret(null);
    setIntentError(null);

    fetch("/api/checkout/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        items: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error ?? "Could not start payment");
        }
        return res.json();
      })
      .then(({ clientSecret }) => {
        if (!cancelled) setClientSecret(clientSecret);
      })
      .catch((e: Error) => {
        if (!cancelled) setIntentError(e.message);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, status]);

  if (status === "loading") return null;
  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-medium text-gray-500">Your cart is empty.</p>
        <button onClick={() => router.push("/")} className="text-orange-500 mt-2 hover:underline">
          Browse restaurants
        </button>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <CheckoutForm
        payment={
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
            Mock checkout — no real payment needed for testing.
          </div>
        }
      />
    );
  }

  if (intentError) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-medium text-red-500">{intentError}</p>
        <button onClick={() => router.push("/")} className="text-orange-500 mt-2 hover:underline">
          Browse restaurants
        </button>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <Elements
      key={clientSecret}
      stripe={stripePromise}
      options={{ clientSecret, appearance: { variables: { colorPrimary: "#f97316" } } }}
    >
      <StripeCheckoutForm />
    </Elements>
  );
}

function StripeCheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();

  return (
    <CheckoutForm
      payment={<PaymentElement />}
      onPay={async () => {
        if (!stripe || !elements) throw new Error("Payment form is still loading");
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          redirect: "if_required",
        });
        if (error) throw new Error(error.message ?? "Payment failed");
        if (paymentIntent?.status !== "succeeded") {
          throw new Error("Payment was not completed");
        }
        return paymentIntent.id;
      }}
    />
  );
}

function CheckoutForm({
  payment,
  onPay,
}: {
  payment: ReactNode;
  /** Confirms payment and returns the PaymentIntent id. Omitted in mock mode. */
  onPay?: () => Promise<string>;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { items, restaurantId, restaurantName, subtotal, clearCart } = useCart();
  const [submitError, setSubmitError] = useState<string | null>(null);
  // If payment succeeds but the order request fails, keep the intent id so a
  // retry creates the order without charging the card again.
  const paidIntentId = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: session?.user?.name ?? "" },
  });

  const total = subtotal + DELIVERY_FEE;

  async function onSubmit(data: FormData) {
    setSubmitError(null);
    try {
      let stripePaymentId = "MOCK";
      if (onPay) {
        if (!paidIntentId.current) {
          paidIntentId.current = await onPay();
        }
        stripePaymentId = paidIntentId.current;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          deliveryAddress: data.address,
          items: items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            unitPrice: i.price,
          })),
          stripePaymentId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(
          err?.error ??
            (paidIntentId.current
              ? "Your payment went through but the order could not be placed. Please try again."
              : "Could not place the order. Please try again.")
        );
      }

      const { orderId } = await res.json();
      clearCart();
      router.push(`/checkout/confirmation?orderId=${orderId}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-bold text-lg">Delivery details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input
                {...register("name")}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                {...register("phone")}
                type="tel"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery address</label>
              <textarea
                {...register("address")}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                placeholder="123 Main St, City, State"
              />
              {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-lg mb-3">Payment</h2>
            {payment}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-lg mb-4">Order summary</h2>
            <p className="text-sm text-gray-500 mb-3">{restaurantName}</p>
            <ul className="space-y-2 divide-y divide-gray-50">
              {items.map((item) => (
                <li key={item.menuItemId} className="flex justify-between pt-2 text-sm">
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="border-t mt-4 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery fee</span>
                <span>{formatCurrency(DELIVERY_FEE)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {submitError && (
            <p className="text-red-500 text-sm bg-red-50 rounded-xl p-3">{submitError}</p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting
              ? onPay
                ? "Processing payment..."
                : "Placing order..."
              : `${onPay ? "Pay" : "Place order"} · ${formatCurrency(total)}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
