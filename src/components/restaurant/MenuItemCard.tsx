import { MenuItemData } from "@/types";
import { formatCurrency } from "@/lib/utils";
import AddToCartButton from "./AddToCartButton";

interface Props {
  item: MenuItemData;
  restaurantId: string;
  restaurantName: string;
}

export default function MenuItemCard({ item, restaurantId, restaurantName }: Props) {
  return (
    <div className="group flex items-start gap-4 p-4 rounded-xl bg-white border border-gray-100 transition-all duration-200 hover:border-orange-200 hover:shadow-md hover:-translate-y-0.5">
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt={item.name}
          className="w-20 h-20 rounded-lg object-cover flex-shrink-0 group-hover:scale-105 transition-transform duration-300"
        />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900">{item.name}</h4>
        {item.description && (
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
        )}
        <p className="text-orange-500 font-bold mt-1">{formatCurrency(item.price)}</p>
      </div>
      {item.isAvailable && (
        <AddToCartButton
          item={{
            id: item.id,
            menuItemId: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            restaurantId,
            restaurantName,
            image: item.image,
          }}
        />
      )}
    </div>
  );
}
