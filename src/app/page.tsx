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
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-orange-400 to-amber-300 px-6 py-12 sm:px-12 sm:py-16 text-white">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight animate-fade-up">
            What are you craving?
          </h1>
          <p className="mt-3 text-orange-50 text-lg animate-fade-up [animation-delay:100ms]">
            Hot food from the best local spots, at your door in minutes.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm font-semibold animate-fade-up [animation-delay:200ms]">
            <span className="bg-white/20 backdrop-blur rounded-full px-4 py-2">
              ⚡ 3-click checkout
            </span>
            <span className="bg-white/20 backdrop-blur rounded-full px-4 py-2">
              🚀 Fast delivery
            </span>
            <span className="bg-white/20 backdrop-blur rounded-full px-4 py-2">
              ⭐ Top-rated restaurants
            </span>
          </div>
        </div>
        <span className="hidden sm:block absolute right-12 top-8 text-7xl animate-float select-none" aria-hidden>
          🍕
        </span>
        <span className="hidden sm:block absolute right-36 bottom-6 text-6xl animate-float [animation-delay:1s] select-none" aria-hidden>
          🍣
        </span>
        <span className="hidden md:block absolute right-64 top-16 text-5xl animate-float [animation-delay:2s] select-none" aria-hidden>
          🌮
        </span>
      </div>

      <Suspense>
        <CategoryFilter categories={categories} />
      </Suspense>

      {restaurants.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-5xl mb-3">🍽️</p>
          <p className="text-lg font-medium">No restaurants found</p>
          <p className="text-sm mt-1">Try a different category or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {restaurants.map((r, i) => (
            <div
              key={r.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 75}ms` }}
            >
              <RestaurantCard restaurant={r} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
