# QuickOrder

Food delivery website — simpler and faster than DoorDash. Goal: pick a restaurant, pick items, check out in 3 clicks.

## Tech Stack

- **Framework:** Next.js 14 (App Router, Server Components)
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL via Prisma ORM (v7)
- **Auth:** NextAuth.js v4 (credentials + JWT strategy)
- **Validation:** Zod + react-hook-form
- **Testing:** Jest + React Testing Library

## Project Structure

```
src/
  app/                  # Next.js App Router pages and API routes
    (auth)/             # Login and register pages (no shared layout chrome)
    restaurants/[slug]/ # Restaurant menu page
    checkout/           # Checkout + order confirmation
    profile/            # User order history
    api/                # REST endpoints (auth, orders)
  components/
    ui/                 # Primitive components (Button, Spinner)
    layout/             # Navbar, CartSidebar
    home/               # RestaurantCard, CategoryFilter
    restaurant/         # MenuItemCard, AddToCartButton
  context/
    CartContext.tsx      # Global cart state (useReducer + localStorage)
  lib/
    prisma.ts           # Singleton PrismaClient
    auth.ts             # NextAuth config
    utils.ts            # cn(), formatCurrency(), slugify()
  types/index.ts        # Shared TypeScript interfaces
prisma/
  schema.prisma         # Database schema
  seed.ts               # Seed script (5 restaurants, 25+ menu items, demo user)
```

## Database

Prisma 7 requires connection URL in `prisma.config.ts` (not `schema.prisma`). The config reads from `.env` via `dotenv/config`.

### Option A — Docker (easiest, all platforms)

```bash
docker run --name quickorder-pg \
  -e POSTGRES_USER=quick_order_user \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=quick_order \
  -p 5432:5432 -d postgres:16
```

### Option B — Windows (native install)

Install PostgreSQL from https://www.postgresql.org/download/windows/, then in PowerShell:

```powershell
# Start the service (name may vary by version — check Services app)
net start postgresql-x64-16

# Create user and database (psql lives in C:\Program Files\PostgreSQL\16\bin)
& "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres -c "CREATE USER quick_order_user WITH PASSWORD 'secret' CREATEDB;"
& "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres -c "CREATE DATABASE quick_order OWNER quick_order_user;"
```

### Option C — Debian/Ubuntu Linux

```bash
pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER quick_order_user WITH PASSWORD 'secret' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE quick_order OWNER quick_order_user;"
```

### Then (all platforms)

```bash
npx prisma migrate dev   # apply migrations
npx prisma db seed       # seed demo data
```

Demo login: `demo@quickorder.com` / `password123`

## Development

```bash
npm run dev       # Start dev server at http://localhost:3000
npm test          # Run tests
npm run build     # Production build
```

## Environment Variables

Copy `.env.local` (already present) to `.env` for Prisma CLI:

```
DATABASE_URL=postgresql://quick_order_user:secret@localhost:5432/quick_order
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-change-in-production-32chars
```

Stripe keys are optional — checkout works in mock mode without them.

## Key Architectural Decisions

**Cart lives in React context backed by localStorage.** Cart state persists across page navigations via a reducer. On login, cart syncs from localStorage. For logged-in users, the `/api/orders` POST clears the DB cart atomically with order creation.

**Cross-restaurant guard in CartContext.** `addItem()` returns `false` if the new item belongs to a different restaurant than the current cart. The caller (`AddToCartButton`) shows a confirmation modal and may force-clear with `addItem(item, true)`.

**Server Components for data fetching.** Home page, restaurant page, profile page, and confirmation page are all Server Components — they query Prisma directly without an API hop. Only interactive pieces (`AddToCartButton`, `CategoryFilter`, auth pages, checkout) are Client Components.

**Prisma 7 singleton pattern.** `src/lib/prisma.ts` uses `global` to avoid spawning a new `PrismaClient` on every hot-reload in development.

**Order total is snapshotted.** `OrderItem.unitPrice` captures the price at time of order. Never recompute from current `MenuItem.price`.

**Mock checkout.** Stripe is wired up as a dependency but checkout uses `stripePaymentId: "MOCK"` by default. To add real payments: create a PaymentIntent server-side, render Stripe Elements on the checkout page, and set `stripePaymentId` to the real intent ID.

## Testing

Tests live in `src/__tests__/`. Three test files:

- `utils.test.ts` — pure function tests for `formatCurrency`, `slugify`, `cn`
- `CartContext.test.tsx` — full cart reducer behaviour via `renderHook`
- `api-orders.test.ts` — Zod schema validation and total calculation logic

```bash
npm test
```

API route and database integration tests would require a test database — set `DATABASE_URL` to a separate test DB and use `prisma migrate deploy` in CI.
