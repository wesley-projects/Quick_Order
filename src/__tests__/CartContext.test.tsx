import { renderHook, act } from "@testing-library/react";
import { CartProvider, useCart } from "@/context/CartContext";
import { CartItemData } from "@/types";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

const makeItem = (overrides: Partial<CartItemData> = {}): CartItemData => ({
  id: "item-1",
  menuItemId: "item-1",
  name: "Margherita",
  price: 13.99,
  quantity: 1,
  restaurantId: "rest-1",
  restaurantName: "Mario's Pizza",
  ...overrides,
});

describe("CartContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.itemCount).toBe(0);
    expect(result.current.subtotal).toBe(0);
  });

  it("adds an item", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeItem()); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.itemCount).toBe(1);
  });

  it("increments quantity when same item added twice", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeItem()); });
    act(() => { result.current.addItem(makeItem()); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.itemCount).toBe(2);
  });

  it("calculates subtotal correctly", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeItem({ price: 10 })); });
    act(() => { result.current.addItem(makeItem({ price: 10 })); });
    expect(result.current.subtotal).toBe(20);
  });

  it("removes an item", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeItem()); });
    act(() => { result.current.removeItem("item-1"); });
    expect(result.current.items).toHaveLength(0);
  });

  it("updates quantity", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeItem()); });
    act(() => { result.current.updateQuantity("item-1", 5); });
    expect(result.current.items[0].quantity).toBe(5);
  });

  it("removes item when quantity set to 0", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeItem()); });
    act(() => { result.current.updateQuantity("item-1", 0); });
    expect(result.current.items).toHaveLength(0);
  });

  it("clears the cart", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeItem()); });
    act(() => { result.current.clearCart(); });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.restaurantId).toBeNull();
  });

  it("returns false when adding item from different restaurant", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeItem()); });
    let success = true;
    act(() => {
      success = result.current.addItem(
        makeItem({ menuItemId: "item-2", restaurantId: "rest-2", restaurantName: "Other" })
      );
    });
    expect(success).toBe(false);
    expect(result.current.items).toHaveLength(1);
  });

  it("force-clears cart and adds new item when forced", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => { result.current.addItem(makeItem()); });
    act(() => {
      result.current.addItem(
        makeItem({ menuItemId: "item-2", restaurantId: "rest-2", restaurantName: "Other" }),
        true
      );
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.restaurantId).toBe("rest-2");
  });

  it("toggles cart open/close", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.isOpen).toBe(false);
    act(() => { result.current.toggleCart(); });
    expect(result.current.isOpen).toBe(true);
    act(() => { result.current.toggleCart(); });
    expect(result.current.isOpen).toBe(false);
  });
});
