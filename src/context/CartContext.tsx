"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  ReactNode,
} from "react";
import { CartItemData } from "@/types";

interface CartState {
  items: CartItemData[];
  restaurantId: string | null;
  restaurantName: string | null;
  isOpen: boolean;
}

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItemData }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "UPDATE_QUANTITY"; payload: { menuItemId: string; quantity: number } }
  | { type: "CLEAR_CART" }
  | { type: "TOGGLE_CART" }
  | { type: "OPEN_CART" }
  | { type: "CLOSE_CART" }
  | { type: "LOAD_CART"; payload: CartState };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find(
        (i) => i.menuItemId === action.payload.menuItemId
      );
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.menuItemId === action.payload.menuItemId
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return {
        ...state,
        restaurantId: action.payload.restaurantId,
        restaurantName: action.payload.restaurantName,
        items: [...state.items, action.payload],
      };
    }
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((i) => i.menuItemId !== action.payload),
      };
    case "UPDATE_QUANTITY":
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(
            (i) => i.menuItemId !== action.payload.menuItemId
          ),
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.menuItemId === action.payload.menuItemId
            ? { ...i, quantity: action.payload.quantity }
            : i
        ),
      };
    case "CLEAR_CART":
      return { ...state, items: [], restaurantId: null, restaurantName: null };
    case "TOGGLE_CART":
      return { ...state, isOpen: !state.isOpen };
    case "OPEN_CART":
      return { ...state, isOpen: true };
    case "CLOSE_CART":
      return { ...state, isOpen: false };
    case "LOAD_CART":
      return action.payload;
    default:
      return state;
  }
}

const initialState: CartState = {
  items: [],
  restaurantId: null,
  restaurantName: null,
  isOpen: false,
};

interface CartContextValue extends CartState {
  addItem: (item: CartItemData, force?: boolean) => boolean;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  itemCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  useEffect(() => {
    const saved = localStorage.getItem("cart");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: "LOAD_CART", payload: { ...parsed, isOpen: false } });
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "cart",
      JSON.stringify({ ...state, isOpen: false })
    );
  }, [state]);

  function addItem(item: CartItemData, force = false): boolean {
    if (
      !force &&
      state.restaurantId &&
      state.restaurantId !== item.restaurantId &&
      state.items.length > 0
    ) {
      return false; // caller should prompt user
    }
    if (force) dispatch({ type: "CLEAR_CART" });
    dispatch({ type: "ADD_ITEM", payload: item });
    dispatch({ type: "OPEN_CART" });
    return true;
  }

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = state.items.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        ...state,
        addItem,
        removeItem: (id) => dispatch({ type: "REMOVE_ITEM", payload: id }),
        updateQuantity: (id, qty) =>
          dispatch({ type: "UPDATE_QUANTITY", payload: { menuItemId: id, quantity: qty } }),
        clearCart: () => dispatch({ type: "CLEAR_CART" }),
        toggleCart: () => dispatch({ type: "TOGGLE_CART" }),
        openCart: () => dispatch({ type: "OPEN_CART" }),
        closeCart: () => dispatch({ type: "CLOSE_CART" }),
        itemCount,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
