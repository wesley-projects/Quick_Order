"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Button from "@/components/ui/Button";

interface OrderRowProps {
  order: {
    id: string;
    status: string;
    total: number;
    deliveryAddress: string;
    createdAt: Date;
    user: { name: string | null; email: string };
    items: { id: string; quantity: number; menuItem: { name: string } }[];
  };
}

const NEXT_STATUS: Record<string, { label: string; value: string }> = {
  PENDING: { label: "Confirm order", value: "CONFIRMED" },
  CONFIRMED: { label: "Start preparing", value: "PREPARING" },
  PREPARING: { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
  OUT_FOR_DELIVERY: { label: "Mark delivered", value: "DELIVERED" },
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-orange-100 text-orange-700",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function OrderRow({ order }: OrderRowProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(status: string) {
    setLoading(true);
    await fetch(`/api/business/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    router.refresh();
  }

  const next = NEXT_STATUS[order.status];
  const isActive = order.status !== "DELIVERED" && order.status !== "CANCELLED";

  return (
    <li className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-sm">
            {order.user.name ?? order.user.email}
            <span className="text-gray-400 font-normal"> · #{order.id.slice(-6)}</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(order.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {order.deliveryAddress}
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
            STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"
          }`}
        >
          {order.status.replace(/_/g, " ")}
        </span>
      </div>

      <ul className="text-sm text-gray-600 space-y-0.5">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.quantity}× {item.menuItem.name}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">{formatCurrency(order.total)}</p>
        {isActive && (
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={loading}
              onClick={() => updateStatus("CANCELLED")}
            >
              Cancel
            </Button>
            {next && (
              <Button size="sm" disabled={loading} onClick={() => updateStatus(next.value)}>
                {next.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
