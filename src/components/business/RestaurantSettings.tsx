"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@/components/ui/Button";

const schema = z.object({
  deliveryFee: z.number({ error: "Enter a valid amount" }).min(0).max(50),
  deliveryTime: z.number({ error: "Enter a valid number" }).int().min(5).max(180),
  isOpen: z.boolean(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  restaurantId: string;
  defaults: { deliveryFee: number; deliveryTime: number; isOpen: boolean };
}

export default function RestaurantSettings({ restaurantId, defaults }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  async function onSubmit(data: FormData) {
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/business/restaurants/${restaurantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const json = await res.json();
      setError(json.error ?? "Could not save settings.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
      <h2 className="font-bold text-lg">Restaurant settings</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Delivery fee ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="50"
            {...register("deliveryFee", { valueAsNumber: true })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {errors.deliveryFee && (
            <p className="text-red-500 text-xs mt-1">{errors.deliveryFee.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Delivery time (min)
          </label>
          <input
            type="number"
            min="5"
            max="180"
            {...register("deliveryTime", { valueAsNumber: true })}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {errors.deliveryTime && (
            <p className="text-red-500 text-xs mt-1">{errors.deliveryTime.message}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <input
          id="isOpen"
          type="checkbox"
          {...register("isOpen")}
          className="w-4 h-4 rounded accent-orange-500"
        />
        <label htmlFor="isOpen" className="text-sm font-medium text-gray-700">
          Restaurant is open and accepting orders
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save settings"}
        </Button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
