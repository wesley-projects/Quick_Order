import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MenuManager from "@/components/business/MenuManager";
import OrderRow from "@/components/business/OrderRow";
import RestaurantSettings from "@/components/business/RestaurantSettings";

export default async function ManageRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/business");

  const { id } = await params;
  const userId = (session.user as { id: string }).id;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      menuItems: { orderBy: [{ menuSection: "asc" }, { name: "asc" }] },
      orders: {
        include: {
          user: { select: { name: true, email: true } },
          items: { include: { menuItem: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!restaurant || restaurant.ownerId !== userId) notFound();

  const activeOrders = restaurant.orders.filter(
    (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED"
  );
  const pastOrders = restaurant.orders.filter(
    (o) => o.status === "DELIVERED" || o.status === "CANCELLED"
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/business" className="text-sm text-gray-400 hover:underline">
            ← Your restaurants
          </Link>
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
        </div>
        <Link
          href={`/restaurants/${restaurant.slug}`}
          className="text-sm text-orange-500 font-medium hover:underline"
        >
          View public page →
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          Incoming orders{" "}
          {activeOrders.length > 0 && (
            <span className="text-sm font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full align-middle">
              {activeOrders.length}
            </span>
          )}
        </h2>
        {activeOrders.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white rounded-2xl border border-gray-100 p-5">
            No active orders right now.
          </p>
        ) : (
          <ul className="space-y-3">
            {activeOrders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
        )}
      </section>

      <RestaurantSettings
        restaurantId={restaurant.id}
        defaults={{
          deliveryFee: restaurant.deliveryFee,
          deliveryTime: restaurant.deliveryTime,
          isOpen: restaurant.isOpen,
        }}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Menu</h2>
        <MenuManager restaurantId={restaurant.id} items={restaurant.menuItems} />
      </section>

      {pastOrders.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Past orders</h2>
          <ul className="space-y-3">
            {pastOrders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
