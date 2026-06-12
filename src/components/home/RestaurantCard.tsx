import Link from "next/link";
import { RestaurantWithCategory } from "@/types";
import { formatCurrency } from "@/lib/utils";

export default function RestaurantCard({ restaurant }: { restaurant: RestaurantWithCategory }) {
  return (
    <Link href={`/restaurants/${restaurant.slug}`} className="group block h-full">
      <div className="h-full rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1 group-hover:border-orange-200">
        <div className="relative aspect-[16/9] bg-gradient-to-br from-orange-100 to-orange-200 overflow-hidden">
          {restaurant.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.image}
              alt={restaurant.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl group-hover:scale-125 transition-transform duration-500">
              {restaurant.category.icon ?? "🍽️"}
            </div>
          )}
          <span className="absolute bottom-3 left-3 bg-white/90 backdrop-blur text-gray-800 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
            🕐 {restaurant.deliveryTime} min
          </span>
          {restaurant.deliveryFee === 0 && (
            <span className="absolute top-3 left-3 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
              Free delivery
            </span>
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
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-900 text-base group-hover:text-orange-500 transition-colors">
              {restaurant.name}
            </h3>
            <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
              ★ {restaurant.rating.toFixed(1)}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-0.5 line-clamp-1">{restaurant.description}</p>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
            <span>{restaurant.category.icon} {restaurant.category.name}</span>
            {restaurant.deliveryFee > 0 && (
              <>
                <span>·</span>
                <span>{formatCurrency(restaurant.deliveryFee)} delivery</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
