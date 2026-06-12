import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import MenuItemCard from "@/components/restaurant/MenuItemCard";

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      menuItems: { where: { isAvailable: true }, orderBy: { menuSection: "asc" } },
      category: true,
    },
  });

  if (!restaurant) notFound();

  const sections = Array.from(new Set(restaurant.menuItems.map((i) => i.menuSection)));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-orange-100 to-orange-200 h-48 sm:h-64 flex items-center justify-center relative">
        {restaurant.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.image}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-8xl">{restaurant.category.icon ?? "🍽️"}</span>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>
        {restaurant.description && (
          <p className="text-gray-500 mt-1">{restaurant.description}</p>
        )}
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
          <span>★ {restaurant.rating.toFixed(1)}</span>
          <span>·</span>
          <span>{restaurant.deliveryTime} min</span>
          <span>·</span>
          <span>
            {restaurant.deliveryFee === 0
              ? "Free delivery"
              : `${formatCurrency(restaurant.deliveryFee)} delivery`}
          </span>
          <span>·</span>
          <span className={restaurant.isOpen ? "text-green-600" : "text-red-500"}>
            {restaurant.isOpen ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section}>
          <h2 className="text-lg font-bold mb-3">{section}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {restaurant.menuItems
              .filter((i) => i.menuSection === section)
              .map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  restaurantId={restaurant.id}
                  restaurantName={restaurant.name}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
