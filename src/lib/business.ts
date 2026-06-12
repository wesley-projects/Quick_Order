import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

/** Returns the restaurant if the current session user owns it, else null. */
export async function getOwnedRestaurant(restaurantId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const userId = (session.user as { id: string }).id;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant || restaurant.ownerId !== userId) return null;
  return restaurant;
}
