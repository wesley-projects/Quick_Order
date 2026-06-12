export interface CartItemData {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId: string;
  restaurantName: string;
  image?: string | null;
}

export interface RestaurantWithCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  rating: number;
  deliveryTime: number;
  deliveryFee: number;
  isOpen: boolean;
  category: { id: string; name: string; icon: string | null };
}

export interface MenuItemData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  isAvailable: boolean;
  menuSection: string;
}
