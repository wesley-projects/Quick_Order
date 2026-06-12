import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BusinessPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/business");

  const userId = (session.user as { id: string }).id;
  const restaurants = await prisma.restaurant.findMany({
    where: { ownerId: userId },
    include: {
      category: true,
      _count: {
        select: {
          menuItems: true,
          orders: { where: { status: { notIn: ["DELIVERED", "CANCELLED"] } } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your restaurants</h1>
        <Link
          href="/business/new"
          className="bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-orange-600 transition-colors"
        >
          + Add restaurant
        </Link>
      </div>

      {restaurants.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-2xl border border-gray-100">
          <p className="font-medium">You don&apos;t have a restaurant yet</p>
          <p className="text-sm mt-1">
            Add your restaurant to start receiving orders on QuickOrder.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {restaurants.map((r) => (
            <li key={r.id}>
              <Link
                href={`/business/${r.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-5 hover:border-orange-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {r.category.icon} {r.name}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {r._count.menuItems} menu items · {r._count.orders} active orders
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      r.isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.isOpen ? "Open" : "Closed"}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
