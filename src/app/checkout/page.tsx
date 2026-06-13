"use client";

import { useEffect, useRef, useState } from "react";
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
import Button from "@/components/ui/Button";

const DELIVERY_FEE = 1.99;

const pubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = pubKey ? loadStripe(pubKey) : null;

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
  const [mock, setMock] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/checkout");
    }
  }, [status, router]);

  // Create a PaymentIntent once, as soon as we have a cart.
  useEffect(() => {
    if (requested.current || items.length === 0 || !restaurantId) return;
    requested.current = true;

    fetch("/api/payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        items: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
      }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not start checkout.");
        if (json.mock || !stripePromise) setMock(true);
        else setClientSecret(json.clientSecret);
      })
      .catch((e) => setInitError(e.message));
  }, [items, restaurantId]);

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

  if (initError) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-medium text-red-500">{initError}</p>
      </div>
    );
  }

  // Mock mode (no Stripe keys) — render the form immediately.
  if (mock) {
    return <CheckoutForm mock />;
  }

  // Real payments — wait for the PaymentIntent, then mount Stripe Elements.
  if (!clientSecret || !stripePromise) {
    return (
      <div className="text-center py-20 text-gray-500">Preparing secure checkout…</div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <CheckoutForm mock={false} />
    </Elements>
  );
}

function CheckoutForm({ mock }: { mock: boolean }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { items, restaurantId, restaurantName, subtotal, clearCart } = useCart();
  const stripe = useStripe();
  const elements = useElements();
  const [payError, setPayError] = useState<string | null>(null);

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
    setPayError(null);

    // Mock mode — skip the card charge entirely.
    if (mock) {
      const res = await postOrder(data, "MOCK");
      if (res.ok) {
        const { orderId } = await res.json();
        clearCart();
        router.push(`/checkout/confirmation?orderId=${orderId}`);
      } else {
        setPayError("Could not place your order. Please try again.");
      }
      return;
    }

    if (!stripe || !elements) return;

    // Charge the card. redirect: "if_required" keeps card payments inline.
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/checkout/confirmation`,
      },
    });

    if (error) {
      setPayError(error.message ?? "Payment failed. Please check your card details.");
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      const res = await postOrder(data, paymentIntent.id);
      if (res.ok) {
        const { orderId } = await res.json();
        clearCart();
        router.push(`/checkout/confirmation?orderId=${orderId}`);
      } else {
        setPayError(
          "Your payment succeeded but we couldn't save the order. Please contact support."
        );
      }
    } else {
      setPayError("Payment was not completed. Please try again.");
    }
  }

  async function postOrder(data: FormData, stripePaymentId: string) {
    return fetch("/api/orders", {
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
            {mock ? (
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
                Mock checkout — no real payment needed for testing.
              </div>
            ) : (
              <PaymentElement />
            )}
            {payError && <p className="text-red-500 text-sm mt-3">{payError}</p>}
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

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting || (!mock && !stripe)}
          >
            {isSubmitting ? "Processing…" : `Place order · ${formatCurrency(total)}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
