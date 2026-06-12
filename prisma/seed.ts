import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const categories = await Promise.all([
    prisma.foodCategory.upsert({ where: { name: "Pizza" }, update: {}, create: { name: "Pizza", icon: "🍕" } }),
    prisma.foodCategory.upsert({ where: { name: "Burgers" }, update: {}, create: { name: "Burgers", icon: "🍔" } }),
    prisma.foodCategory.upsert({ where: { name: "Sushi" }, update: {}, create: { name: "Sushi", icon: "🍣" } }),
    prisma.foodCategory.upsert({ where: { name: "Tacos" }, update: {}, create: { name: "Tacos", icon: "🌮" } }),
    prisma.foodCategory.upsert({ where: { name: "Indian" }, update: {}, create: { name: "Indian", icon: "🍛" } }),
    prisma.foodCategory.upsert({ where: { name: "Desserts" }, update: {}, create: { name: "Desserts", icon: "🍰" } }),
  ]);

  const [pizza, burgers, sushi, tacos, indian] = categories;

  const restaurants = await Promise.all([
    prisma.restaurant.upsert({
      where: { slug: "marios-pizza" },
      update: {},
      create: {
        name: "Mario's Pizza",
        slug: "marios-pizza",
        description: "Authentic Neapolitan pizza baked in a wood-fired oven",
        rating: 4.7,
        deliveryTime: 25,
        deliveryFee: 0,
        categoryId: pizza.id,
      },
    }),
    prisma.restaurant.upsert({
      where: { slug: "burger-barn" },
      update: {},
      create: {
        name: "Burger Barn",
        slug: "burger-barn",
        description: "Juicy smash burgers and crispy fries",
        rating: 4.5,
        deliveryTime: 20,
        deliveryFee: 1.99,
        categoryId: burgers.id,
      },
    }),
    prisma.restaurant.upsert({
      where: { slug: "sakura-sushi" },
      update: {},
      create: {
        name: "Sakura Sushi",
        slug: "sakura-sushi",
        description: "Fresh Japanese sushi and rolls",
        rating: 4.8,
        deliveryTime: 35,
        deliveryFee: 2.99,
        categoryId: sushi.id,
      },
    }),
    prisma.restaurant.upsert({
      where: { slug: "taco-fiesta" },
      update: {},
      create: {
        name: "Taco Fiesta",
        slug: "taco-fiesta",
        description: "Street-style tacos and burritos",
        rating: 4.4,
        deliveryTime: 20,
        deliveryFee: 0,
        categoryId: tacos.id,
      },
    }),
    prisma.restaurant.upsert({
      where: { slug: "spice-garden" },
      update: {},
      create: {
        name: "Spice Garden",
        slug: "spice-garden",
        description: "Rich curries and tandoor specialties",
        rating: 4.6,
        deliveryTime: 30,
        deliveryFee: 1.49,
        categoryId: indian.id,
      },
    }),
  ]);

  const [marios, barn, sakura, fiesta, spice] = restaurants;

  await prisma.menuItem.createMany({
    skipDuplicates: true,
    data: [
      // Mario's Pizza
      { name: "Margherita", description: "Tomato, mozzarella, fresh basil", price: 13.99, menuSection: "Pizzas", restaurantId: marios.id },
      { name: "Pepperoni", description: "Tomato, mozzarella, pepperoni", price: 15.99, menuSection: "Pizzas", restaurantId: marios.id },
      { name: "Quattro Formaggi", description: "Mozzarella, gorgonzola, parmesan, brie", price: 16.99, menuSection: "Pizzas", restaurantId: marios.id },
      { name: "Garlic Bread", description: "Toasted with herb butter", price: 4.99, menuSection: "Starters", restaurantId: marios.id },
      { name: "Tiramisu", description: "Classic Italian dessert", price: 6.99, menuSection: "Desserts", restaurantId: marios.id },

      // Burger Barn
      { name: "Classic Smash", description: "Double smash patty, American cheese, pickles, special sauce", price: 12.99, menuSection: "Burgers", restaurantId: barn.id },
      { name: "Bacon BBQ", description: "Smash patty, bacon, BBQ sauce, onion rings", price: 14.99, menuSection: "Burgers", restaurantId: barn.id },
      { name: "Veggie Stack", description: "Crispy chickpea patty, avocado, sriracha", price: 11.99, menuSection: "Burgers", restaurantId: barn.id },
      { name: "Crinkle Fries", description: "Seasoned crinkle-cut fries", price: 3.99, menuSection: "Sides", restaurantId: barn.id },
      { name: "Onion Rings", description: "Beer-battered golden rings", price: 4.49, menuSection: "Sides", restaurantId: barn.id },

      // Sakura Sushi
      { name: "Salmon Nigiri (2pc)", description: "Fresh Atlantic salmon over sushi rice", price: 6.99, menuSection: "Nigiri", restaurantId: sakura.id },
      { name: "Tuna Nigiri (2pc)", description: "Yellowfin tuna over sushi rice", price: 7.99, menuSection: "Nigiri", restaurantId: sakura.id },
      { name: "Dragon Roll", description: "Shrimp tempura topped with avocado and eel sauce", price: 14.99, menuSection: "Rolls", restaurantId: sakura.id },
      { name: "Spicy Tuna Roll", description: "Tuna, cucumber, spicy mayo", price: 12.99, menuSection: "Rolls", restaurantId: sakura.id },
      { name: "Miso Soup", description: "Traditional Japanese miso with tofu and wakame", price: 2.99, menuSection: "Sides", restaurantId: sakura.id },

      // Taco Fiesta
      { name: "Carne Asada Taco", description: "Grilled steak, onion, cilantro, salsa", price: 3.99, menuSection: "Tacos", restaurantId: fiesta.id },
      { name: "Al Pastor Taco", description: "Marinated pork, pineapple, cilantro", price: 3.99, menuSection: "Tacos", restaurantId: fiesta.id },
      { name: "Veggie Burrito", description: "Beans, rice, roasted veggies, guac", price: 10.99, menuSection: "Burritos", restaurantId: fiesta.id },
      { name: "Chicken Burrito", description: "Grilled chicken, rice, beans, salsa, cheese", price: 11.99, menuSection: "Burritos", restaurantId: fiesta.id },
      { name: "Chips & Guac", description: "Fresh tortilla chips with house-made guacamole", price: 5.99, menuSection: "Sides", restaurantId: fiesta.id },

      // Spice Garden
      { name: "Butter Chicken", description: "Tender chicken in rich tomato cream sauce", price: 15.99, menuSection: "Mains", restaurantId: spice.id },
      { name: "Paneer Tikka Masala", description: "Grilled paneer in spiced tomato gravy", price: 14.99, menuSection: "Mains", restaurantId: spice.id },
      { name: "Garlic Naan", description: "Soft leavened bread with garlic and butter", price: 3.49, menuSection: "Breads", restaurantId: spice.id },
      { name: "Basmati Rice", description: "Fragrant long-grain rice", price: 2.99, menuSection: "Breads", restaurantId: spice.id },
      { name: "Mango Lassi", description: "Chilled yogurt drink with fresh mango", price: 4.49, menuSection: "Drinks", restaurantId: spice.id },
    ],
  });

  // Demo user
  const passwordHash = await bcrypt.hash("password123", 12);
  await prisma.user.upsert({
    where: { email: "demo@quickorder.com" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@quickorder.com",
      passwordHash,
    },
  });

  console.log("Seeded successfully.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
