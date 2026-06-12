"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "@/components/ui/Button";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().max(300).optional(),
  categoryId: z.string().min(1, "Pick a category"),
  deliveryTime: z
    .number({ error: "Required" })
    .int()
    .min(5, "At least 5 minutes")
    .max(120),
  deliveryFee: z.number({ error: "Required" }).min(0).max(20),
  image: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});
type FormData = z.infer<typeof schema>;

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500";

export default function RestaurantForm({
  categories,
}: {
  categories: { id: string; name: string; icon: string | null }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { deliveryTime: 30, deliveryFee: 2.99 },
  });

  async function onSubmit(data: FormData) {
    setError(null);
    const res = await fetch("/api/business/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Something went wrong");
      return;
    }

    const { id } = await res.json();
    router.push(`/business/${id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input {...register("name")} className={inputClass} placeholder="Mario's Pizzeria" />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          {...register("description")}
          className={inputClass}
          rows={2}
          placeholder="Wood-fired pizza since 1985"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select {...register("categoryId")} className={inputClass} defaultValue="">
          <option value="" disabled>
            Select a category
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p className="text-red-500 text-xs mt-1">{errors.categoryId.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Delivery time (min)
          </label>
          <input
            type="number"
            {...register("deliveryTime", { valueAsNumber: true })}
            className={inputClass}
          />
          {errors.deliveryTime && (
            <p className="text-red-500 text-xs mt-1">{errors.deliveryTime.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Delivery fee ($)
          </label>
          <input
            type="number"
            step="0.01"
            {...register("deliveryFee", { valueAsNumber: true })}
            className={inputClass}
          />
          {errors.deliveryFee && (
            <p className="text-red-500 text-xs mt-1">{errors.deliveryFee.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Image URL (optional)
        </label>
        <input {...register("image")} className={inputClass} placeholder="https://..." />
        {errors.image && <p className="text-red-500 text-xs mt-1">{errors.image.message}</p>}
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg p-3">{error}</p>}

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create restaurant"}
      </Button>
    </form>
  );
}
