import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import Button from "@/components/ui/Button";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  if (!orderId) notFound();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      restaurant: { select: { name: true } },
      items: { include: { menuItem: { select: { name: true } } } },
    },
  });

  if (!order) notFound();

  const itemsSubtotal = order.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity,
    0
  );
  const deliveryFee = order.total - itemsSubtotal;

  return (
    <div className="max-w-lg mx-auto text-center py-12 space-y-6">
      <div className="text-6xl">🎉</div>
      <div>
        <h1 className="text-2xl font-bold">Order confirmed!</h1>
        <p className="text-gray-500 mt-1">
          Your order from <strong>{order.restaurant.name}</strong> is being prepared.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 text-left space-y-3">
        <div className="flex justify-between text-sm text-gray-500">
          <span>Order ID</span>
          <span className="font-mono text-xs">{order.id.slice(0, 8)}…</span>
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>Estimated delivery</span>
          <span>30–45 min</span>
        </div>
        <div className="flex justify-between text-sm text-gray-500">
          <span>Delivery address</span>
          <span className="text-right max-w-[60%]">{order.deliveryAddress}</span>
        </div>
        <div className="border-t pt-3 space-y-1">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.quantity}× {item.menuItem.name}</span>
              <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 space-y-1 text-sm text-gray-500">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(itemsSubtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery fee</span>
            <span>{formatCurrency(deliveryFee)}</span>
          </div>
        </div>
        <div className="border-t pt-3 flex justify-between font-bold">
          <span>Total</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <Link href="/profile">
          <Button variant="secondary">View all orders</Button>
        </Link>
        <Link href="/">
          <Button>Order again</Button>
        </Link>
      </div>
    </div>
  );
}
