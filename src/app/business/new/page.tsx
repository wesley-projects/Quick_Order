import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import RestaurantForm from "@/components/business/RestaurantForm";

export default async function NewRestaurantPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/business/new");

  const categories = await prisma.foodCategory.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add your restaurant</h1>
      <RestaurantForm categories={categories} />
    </div>
  );
}
