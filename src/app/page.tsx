import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import RestaurantCard from "@/components/home/RestaurantCard";
import CategoryFilter from "@/components/home/CategoryFilter";

interface SearchParams {
  category?: string;
  q?: string;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [categories, restaurants] = await Promise.all([
    prisma.foodCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.restaurant.findMany({
      where: {
        ...(params.category && {
          category: { name: params.category },
        }),
        ...(params.q && {
          name: { contains: params.q, mode: "insensitive" },
        }),
      },
      include: { category: true },
      orderBy: { rating: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          What are you craving?
        </h1>
        <p className="text-gray-500 mt-1">Order from the best local restaurants</p>
      </div>

      <Suspense>
        <CategoryFilter categories={categories} />
      </Suspense>

      {restaurants.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg font-medium">No restaurants found</p>
          <p className="text-sm mt-1">Try a different category or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {restaurants.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
      )}
    </div>
  );
}
