"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCart } from "@/context/CartContext";
import { formatCurrency } from "@/lib/utils";
import Button from "@/components/ui/Button";

const schema = z.object({
  address: z.string().min(10, "Enter a full delivery address"),
  name: z.string().min(2, "Enter your name"),
  phone: z.string().min(7, "Enter a valid phone number"),
});
type FormData = z.infer<typeof schema>;

export default function CheckoutPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { items, restaurantId, restaurantName, subtotal, clearCart } = useCart();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/checkout");
    }
  }, [status, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: session?.user?.name ?? "" },
  });

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

  const deliveryFee = 1.99;
  const total = subtotal + deliveryFee;

  async function onSubmit(data: FormData) {
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
        stripePaymentId: "MOCK",
      }),
    });

    if (res.ok) {
      const { orderId } = await res.json();
      clearCart();
      router.push(`/checkout/confirmation?orderId=${orderId}`);
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
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              Mock checkout — no real payment needed for testing.
            </div>
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
                <span>{formatCurrency(deliveryFee)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Placing order..." : `Place order · ${formatCurrency(total)}`}
          </Button>
        </div>
      </form>
    </div>
  );
}
