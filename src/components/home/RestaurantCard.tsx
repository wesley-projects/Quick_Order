import Link from "next/link";
import { RestaurantWithCategory } from "@/types";
import { formatCurrency } from "@/lib/utils";

export default function RestaurantCard({ restaurant }: { restaurant: RestaurantWithCategory }) {
  return (
    <Link href={`/restaurants/${restaurant.slug}`} className="group block">
      <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <div className="relative aspect-[16/9] bg-gradient-to-br from-orange-100 to-orange-200 overflow-hidden">
          {restaurant.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.image}
              alt={restaurant.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">
              {restaurant.category.icon ?? "🍽️"}
            </div>
          )}
          {!restaurant.isOpen && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white text-gray-800 font-semibold px-3 py-1 rounded-full text-sm">
                Closed
              </span>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-bold text-gray-900 text-base">{restaurant.name}</h3>
          <p className="text-gray-500 text-sm mt-0.5 line-clamp-1">{restaurant.description}</p>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <span className="text-yellow-400">★</span>
              {restaurant.rating.toFixed(1)}
            </span>
            <span>·</span>
            <span>{restaurant.deliveryTime} min</span>
            <span>·</span>
            <span>
              {restaurant.deliveryFee === 0
                ? "Free delivery"
                : `${formatCurrency(restaurant.deliveryFee)} delivery`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
