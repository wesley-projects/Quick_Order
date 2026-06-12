"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatCurrency } from "@/lib/utils";
import Button from "@/components/ui/Button";

interface MenuManagerProps {
  restaurantId: string;
  items: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    menuSection: string;
    isAvailable: boolean;
  }[];
}

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().max(300).optional(),
  price: z.number({ error: "Price is required" }).positive("Price must be positive"),
  menuSection: z.string().min(1, "Section is required"),
});
type FormData = z.infer<typeof schema>;

const inputClass =
  "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500";

export default function MenuManager({ restaurantId, items }: MenuManagerProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(items.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setError(null);
    const res = await fetch(`/api/business/restaurants/${restaurantId}/menu-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Something went wrong");
      return;
    }
    reset({ name: "", description: "", price: undefined, menuSection: data.menuSection });
    router.refresh();
  }

  async function toggleAvailable(id: string, isAvailable: boolean) {
    setBusyId(id);
    await fetch(`/api/business/menu-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable }),
    });
    setBusyId(null);
    router.refresh();
  }

  async function deleteItem(id: string) {
    setBusyId(id);
    await fetch(`/api/business/menu-items/${id}`, { method: "DELETE" });
    setBusyId(null);
    router.refresh();
  }

  const sections = Array.from(new Set(items.map((i) => i.menuSection)));

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section} className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-sm text-gray-500 uppercase tracking-wide mb-3">
            {section}
          </h3>
          <ul className="divide-y divide-gray-50">
            {items
              .filter((i) => i.menuSection === section)
              .map((item) => (
                <li key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className={item.isAvailable ? "" : "opacity-50"}>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busyId === item.id}
                      onClick={() => toggleAvailable(item.id, !item.isAvailable)}
                    >
                      {item.isAvailable ? "Hide" : "Show"}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyId === item.id}
                      onClick={() => deleteItem(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ))}

      {showForm ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3"
        >
          <h3 className="font-bold text-sm">Add menu item</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input {...register("name")} className={inputClass} placeholder="Item name" />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <input
                type="number"
                step="0.01"
                {...register("price", { valueAsNumber: true })}
                className={inputClass}
                placeholder="Price"
              />
              {errors.price && (
                <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>
              )}
            </div>
          </div>
          <div>
            <input
              {...register("menuSection")}
              className={inputClass}
              placeholder='Section (e.g. "Mains", "Drinks")'
            />
            {errors.menuSection && (
              <p className="text-red-500 text-xs mt-1">{errors.menuSection.message}</p>
            )}
          </div>
          <input
            {...register("description")}
            className={inputClass}
            placeholder="Description (optional)"
          />
          {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg p-3">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add item"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Close
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>
          + Add menu item
        </Button>
      )}
    </div>
  );
}
