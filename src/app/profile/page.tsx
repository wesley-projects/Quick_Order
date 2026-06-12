import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-orange-100 text-orange-700",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/profile");

  const userId = (session.user as { id: string }).id;
  const orders = await prisma.order.findMany({
    where: { userId },
    include: {
      restaurant: { select: { name: true, slug: true } },
      items: { include: { menuItem: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your orders</h1>
        <p className="text-gray-500 text-sm mt-1">{session.user.email}</p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-2xl border border-gray-100">
          <p className="font-medium">No orders yet</p>
          <Link href="/" className="text-orange-500 text-sm mt-1 block hover:underline">
            Browse restaurants
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/restaurants/${order.restaurant.slug}`}
                    className="font-bold hover:text-orange-500 transition-colors"
                  >
                    {order.restaurant.name}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {order.status.replace(/_/g, " ")}
                </span>
              </div>
              <ul className="text-sm text-gray-600 space-y-0.5">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.menuItem.name}
                  </li>
                ))}
              </ul>
              <p className="text-sm font-bold">{formatCurrency(order.total)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
