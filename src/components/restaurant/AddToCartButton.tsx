"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { CartItemData } from "@/types";
import Button from "@/components/ui/Button";

interface Props {
  item: CartItemData;
}

export default function AddToCartButton({ item }: Props) {
  const { addItem, restaurantName } = useCart();
  const [showConfirm, setShowConfirm] = useState(false);

  function handleAdd() {
    const success = addItem(item);
    if (!success) setShowConfirm(true);
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
          <h3 className="font-bold text-lg mb-2">Start a new order?</h3>
          <p className="text-gray-600 text-sm mb-5">
            Your cart has items from <strong>{restaurantName}</strong>. Starting a
            new order will clear it.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                addItem(item, true);
                setShowConfirm(false);
              }}
            >
              Start new order
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleAdd}
      className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center text-xl font-bold transition-colors flex-shrink-0"
    >
      +
    </button>
  );
}
