# RestockRadar

A restock tracker for Pokémon TCG product, built around one question: **can I buy
this at retail price right now?**

Every product has an MSRP. Every retailer listing is checked on a schedule and
compared against it. Anything at or below MSRP gets flagged; anything above it
gets labelled with the markup, so a $120 Elite Trainer Box never gets mistaken
for a restock worth chasing.

<!-- Screenshots: run `npm run dev` and see /, /product/[slug], /restocks, /status -->

## What it does

- **Live board** (`/`) — every tracked product, its best in-stock price, and
  whether that price is at retail. Filter by set, product type, in-stock only
  or at-retail only. Refreshes itself every 30 seconds.
- **Product pages** (`/product/[slug]`) — per-retailer status, price, markup,
  when it was last in stock and when it was last checked, plus the full
  restock history for that product.
- **Restock feed** (`/restocks`) — every stock and price transition the monitor
  has recorded, newest first, filterable to retail-price events only.
- **Alerts** — watch a product and get notified when it is in stock at or below
  MSRP, or below a ceiling you set. Each watch has its own unsubscribe link.
- **Monitor** (`/status`) — check volume, failure rate, average latency, and
  which retailer adapters are actually configured.
- **JSON API** — `/api/board`, `/api/events`, `/api/health`.

## Quick start

```bash
npm install
cp .env.example .env
npm run db:reset     # create the SQLite database and seed demo data
npm run dev          # http://localhost:3001
```

`db:reset` seeds 14 products across 6 retailers and replays the simulator over
the previous 72 hours, so the board and the feed have real history on first
load. No database server is needed — it is SQLite on disk.

Run a polling cycle by hand:

```bash
npm run check              # only listings that are due
npm run check -- --force   # every listing, ignoring intervals
npm run check -- --loop 60 # keep polling every 60s
```

## Where the stock data comes from

Out of the box, **demo mode is on** and every retailer is checked by a
simulator (`src/lib/checker/adapters/mock.ts`). Prices and stock states on a
fresh clone are generated, not real — `/status` says so on the page, and so
does the site footer. Set `DEMO_MODE=false` to use real adapters instead.

| Adapter | State | Notes |
| --- | --- | --- |
| `mock` | Always ready | Deterministic simulator. Big-box stores quote exactly MSRP; the resale marketplace sits well above it. |
| `bestbuy` | Real, needs a key | Uses Best Buy's official Products API. Get a free key at [developer.bestbuy.com](https://developer.bestbuy.com) and set `BESTBUY_API_KEY`. |
| `target`, `walmart`, `pokemon-center`, `costco` | Stubs | Each one documents the route to a working implementation in `src/lib/checker/adapters/stubs.ts`. |

### Writing a new adapter

1. Implement `RetailerAdapter` (`src/lib/checker/types.ts`) — a `check()` that
   returns a status and a price in cents.
2. Register it in `src/lib/checker/registry.ts`.
3. Point a `Retailer` row's `adapterKey` at it.

Nothing else changes. An adapter that reports `UNKNOWN` never produces a false
restock, and one that throws is recorded as a failure and backed off
exponentially rather than retried every cycle.

A word on the stubs being stubs: prefer an official or affiliate API over
parsing a storefront. Several large retailers forbid automated scraping in
their terms, and most block datacenter IPs regardless. `Retailer.minIntervalSec`
exists so you can poll politely — please use it.

## How the checker works

`runChecks()` (`src/lib/checker/runner.ts`) is one polling cycle:

1. Load active listings whose interval has elapsed (with exponential backoff on
   consecutive failures, capped at an hour).
2. Check them through their adapter, six at a time.
3. Record every attempt in `CheckRun`, success or failure.
4. Diff the result against the listing's last known state.
5. Write a `StockEvent` only on a real transition, and notify matching watches.

The diffing rules live in `src/lib/checker/diff.ts` and are deliberately
conservative, because a restock alert that turns out to be nothing is worse
than no alert:

- A failed check (`UNKNOWN`) never produces an event.
- The **first** successful check of a listing never produces an event either —
  otherwise seeding the database would fire a restock alert for everything that
  happened to be in stock at that moment.
- Only transitions count, and a price move must clear both an absolute (50¢)
  and a relative (1%) floor to be worth reporting.

Alert dedupe is enforced by the database: `Alert` is unique on
`(watchId, stockEventId)`, so a retried cycle cannot double-notify.

## Scheduling

The polling entry point is `POST /api/cron/check`, protected by `CRON_SECRET`:

```bash
curl -X POST https://your-host/api/cron/check \
  -H "authorization: Bearer $CRON_SECRET"
```

`vercel.json` schedules it every 5 minutes on Vercel; any scheduler that can
send a header works elsewhere. With no `CRON_SECRET` set the route is open in
development and **refuses to run in production**, so it can never be used to
make your deployment hammer retailers.

## Alerts

With `ALERT_WEBHOOK_URL` set, alerts POST a JSON body carrying both `content`
and `text`, which Discord and Slack webhooks both accept. Without it they are
logged to the console. Email is intentionally not wired up — it needs a
provider and a verified sender, which is a deployment decision; add a branch in
`src/lib/notify.ts` when you have one.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Defaults to `file:./prisma/dev.db`. |
| `CRON_SECRET` | in production | Bearer token for `/api/cron/check`. |
| `DEMO_MODE` | no | `false` uses real adapters instead of the simulator. |
| `ALERT_WEBHOOK_URL` | no | Discord/Slack webhook for restock alerts. |
| `BESTBUY_API_KEY` | no | Enables the Best Buy adapter. |
| `CHECKER_USER_AGENT` | no | Identifies the checker to retailers. Be honest here. |

## Tech

Next.js 14 (App Router, Server Components) · Tailwind CSS · Prisma 7 with a
better-sqlite3 driver adapter · Zod · Jest.

Moving to Postgres is a two-line change: swap the `provider` in
`prisma/schema.prisma` and the adapter in `src/lib/prisma.ts` for
`@prisma/adapter-pg`. Nothing in the schema is SQLite-specific.

> **Note:** `better-sqlite3` must stay out of the webpack bundle for its native
> binding to load — see the `externals` list in `next.config.mjs`. If you switch
> to Postgres you can drop that entirely.

## Tests

```bash
npm test
```

Covers the money and correctness logic rather than the rendering: the at-retail
comparison and markup maths, the event diffing rules, the backoff and interval
scheduling, and the simulator's guarantees (stable within a window, big-box
quotes land exactly on MSRP, the marketplace is always stocked and always above
it).

## Legal

RestockRadar tracks retail availability. It is not affiliated with Nintendo,
Creatures Inc., GAME FREAK Inc., The Pokémon Company, or any retailer listed.
Pokémon and the Pokémon TCG are their respective owners' trademarks. Product
names and MSRPs in the seed are real-world reference values; all prices and
stock states in the demo are simulated.
