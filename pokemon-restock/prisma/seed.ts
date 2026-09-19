import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { PRODUCT_KIND, STOCK_STATUS, type StockStatus } from "../src/lib/constants";
import { simulate } from "../src/lib/checker/adapters/mock";
import { diffCheck, type PriorState } from "../src/lib/checker/diff";

/**
 * Demo data.
 *
 * Product names, sets and MSRPs are real-world reference values; prices and
 * stock states are simulated. Retailer links are search URLs rather than
 * invented product pages, so every link on the seeded site actually goes
 * somewhere useful.
 */

const K = PRODUCT_KIND;

const RETAILERS = [
  {
    slug: "target",
    name: "Target",
    homepage: "https://www.target.com",
    adapterKey: "target",
    accent: "#cc0000",
    minIntervalSec: 180,
    search: (q: string) => `https://www.target.com/s?searchTerm=${encodeURIComponent(q)}`,
  },
  {
    slug: "walmart",
    name: "Walmart",
    homepage: "https://www.walmart.com",
    adapterKey: "walmart",
    accent: "#0071ce",
    minIntervalSec: 180,
    search: (q: string) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    slug: "best-buy",
    name: "Best Buy",
    homepage: "https://www.bestbuy.com",
    adapterKey: "bestbuy",
    accent: "#ffe000",
    minIntervalSec: 240,
    search: (q: string) =>
      `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}`,
  },
  {
    slug: "pokemon-center",
    name: "Pokemon Center",
    homepage: "https://www.pokemoncenter.com",
    adapterKey: "pokemon-center",
    accent: "#ffcb05",
    minIntervalSec: 300,
    search: (q: string) =>
      `https://www.pokemoncenter.com/search/${encodeURIComponent(q)}`,
  },
  {
    slug: "costco",
    name: "Costco",
    homepage: "https://www.costco.com",
    adapterKey: "costco",
    accent: "#e31837",
    minIntervalSec: 600,
    search: (q: string) =>
      `https://www.costco.com/CatalogSearch?keyword=${encodeURIComponent(q)}`,
  },
  {
    // The contrast case: always in stock, never at retail. Keeps the
    // "at retail only" filter honest.
    slug: "card-market",
    name: "Resale Marketplace",
    homepage: "https://www.tcgplayer.com",
    adapterKey: "mock",
    accent: "#8b5cf6",
    minIntervalSec: 600,
    search: (q: string) =>
      `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(q)}`,
  },
];

interface SeedProduct {
  slug: string;
  name: string;
  setName: string;
  kind: string;
  msrpCents: number;
  releaseDate: string;
  description: string;
  retailers: string[];
}

const PRODUCTS: SeedProduct[] = [
  {
    slug: "prismatic-evolutions-elite-trainer-box",
    name: "Prismatic Evolutions Elite Trainer Box",
    setName: "Prismatic Evolutions",
    kind: K.ELITE_TRAINER_BOX,
    msrpCents: 5999,
    releaseDate: "2025-01-17",
    description:
      "Nine boosters, sleeves, dice and the set's promo. The hardest ETB of the modern era to find at MSRP.",
    retailers: ["target", "walmart", "best-buy", "pokemon-center", "card-market"],
  },
  {
    slug: "prismatic-evolutions-booster-bundle",
    name: "Prismatic Evolutions Booster Bundle",
    setName: "Prismatic Evolutions",
    kind: K.BOOSTER_BUNDLE,
    msrpCents: 2694,
    releaseDate: "2025-01-17",
    description: "Six boosters, no extras. The cheapest legitimate way into the set.",
    retailers: ["target", "walmart", "pokemon-center", "card-market"],
  },
  {
    slug: "surging-sparks-elite-trainer-box",
    name: "Surging Sparks Elite Trainer Box",
    setName: "Surging Sparks",
    kind: K.ELITE_TRAINER_BOX,
    msrpCents: 4999,
    releaseDate: "2024-11-08",
    description: "Pikachu ex headlines the set; the ETB carries nine boosters and accessories.",
    retailers: ["target", "walmart", "best-buy", "costco", "card-market"],
  },
  {
    slug: "surging-sparks-booster-bundle",
    name: "Surging Sparks Booster Bundle",
    setName: "Surging Sparks",
    kind: K.BOOSTER_BUNDLE,
    msrpCents: 2694,
    releaseDate: "2024-11-08",
    description: "Six-pack bundle. Restocks more often than the ETB and sells out slower.",
    retailers: ["target", "walmart", "pokemon-center", "card-market"],
  },
  {
    slug: "scarlet-violet-151-elite-trainer-box",
    name: "Scarlet & Violet—151 Elite Trainer Box",
    setName: "Scarlet & Violet—151",
    kind: K.ELITE_TRAINER_BOX,
    msrpCents: 5999,
    releaseDate: "2023-09-22",
    description: "The original-151 set. Perennially reprinted and perennially gone.",
    retailers: ["target", "walmart", "best-buy", "pokemon-center", "card-market"],
  },
  {
    slug: "journey-together-elite-trainer-box",
    name: "Journey Together Elite Trainer Box",
    setName: "Journey Together",
    kind: K.ELITE_TRAINER_BOX,
    msrpCents: 4999,
    releaseDate: "2025-03-28",
    description: "Trainer's Pokemon mechanics debut here. Nine boosters plus accessories.",
    retailers: ["target", "walmart", "best-buy", "card-market"],
  },
  {
    slug: "destined-rivals-elite-trainer-box",
    name: "Destined Rivals Elite Trainer Box",
    setName: "Destined Rivals",
    kind: K.ELITE_TRAINER_BOX,
    msrpCents: 4999,
    releaseDate: "2025-05-30",
    description: "Team Rocket's return. Heavy print run, still hard to catch at retail.",
    retailers: ["target", "walmart", "best-buy", "pokemon-center", "card-market"],
  },
  {
    slug: "black-bolt-elite-trainer-box",
    name: "Black Bolt Elite Trainer Box",
    setName: "Black Bolt",
    kind: K.ELITE_TRAINER_BOX,
    msrpCents: 5999,
    releaseDate: "2025-07-18",
    description: "One half of the Black Bolt / White Flare pair.",
    retailers: ["target", "walmart", "pokemon-center", "card-market"],
  },
  {
    slug: "white-flare-elite-trainer-box",
    name: "White Flare Elite Trainer Box",
    setName: "White Flare",
    kind: K.ELITE_TRAINER_BOX,
    msrpCents: 5999,
    releaseDate: "2025-07-18",
    description: "The other half. Usually restocks alongside Black Bolt.",
    retailers: ["target", "walmart", "pokemon-center", "card-market"],
  },
  {
    slug: "twilight-masquerade-booster-box",
    name: "Twilight Masquerade Booster Box",
    setName: "Twilight Masquerade",
    kind: K.BOOSTER_BOX,
    msrpCents: 16164,
    releaseDate: "2024-05-24",
    description: "Thirty-six packs. Hobby-channel product, so big-box stock is rare.",
    retailers: ["best-buy", "card-market"],
  },
  {
    slug: "paldean-fates-elite-trainer-box",
    name: "Paldean Fates Elite Trainer Box",
    setName: "Paldean Fates",
    kind: K.ELITE_TRAINER_BOX,
    msrpCents: 4999,
    releaseDate: "2024-01-26",
    description: "Shiny-heavy special set. Restocks are sporadic and small.",
    retailers: ["target", "walmart", "costco", "card-market"],
  },
  {
    slug: "charizard-ex-super-premium-collection",
    name: "Charizard ex Super-Premium Collection",
    setName: "Special Collections",
    kind: K.COLLECTION_BOX,
    msrpCents: 11999,
    releaseDate: "2023-10-20",
    description: "Figure, jumbo card and eight boosters. Gift-season target every year.",
    retailers: ["target", "best-buy", "pokemon-center", "card-market"],
  },
  {
    slug: "paldea-legends-tin",
    name: "Paldea Legends Tin",
    setName: "Tins & Blisters",
    kind: K.TIN,
    msrpCents: 2499,
    releaseDate: "2024-09-13",
    description: "Four boosters and a promo. The easiest product on this board to find.",
    retailers: ["target", "walmart", "costco", "card-market"],
  },
  {
    slug: "three-pack-blister-assorted",
    name: "Three-Pack Blister (Assorted)",
    setName: "Tins & Blisters",
    kind: K.BLISTER,
    msrpCents: 1399,
    releaseDate: "2025-02-14",
    description: "Three boosters and a promo card. Checkout-lane staple.",
    retailers: ["target", "walmart", "best-buy", "costco"],
  },
];

/** How far back the simulated history runs. */
const BACKFILL_HOURS = 72;
const WINDOW_MS = 10 * 60 * 1000;

async function main() {
  console.log("Resetting demo data…");
  // Order matters: children before parents, since SQLite cascades are enforced
  // per-statement rather than deferred.
  await prisma.alert.deleteMany();
  await prisma.checkRun.deleteMany();
  await prisma.stockEvent.deleteMany();
  await prisma.watch.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.product.deleteMany();
  await prisma.retailer.deleteMany();

  const retailerBySlug = new Map<string, { id: string }>();
  for (const r of RETAILERS) {
    const created = await prisma.retailer.create({
      data: {
        slug: r.slug,
        name: r.name,
        homepage: r.homepage,
        adapterKey: r.adapterKey,
        accent: r.accent,
        minIntervalSec: r.minIntervalSec,
      },
    });
    retailerBySlug.set(r.slug, created);
  }
  console.log(`  ${RETAILERS.length} retailers`);

  let listingCount = 0;
  const listings: Array<{
    id: string;
    productSlug: string;
    productName: string;
    msrpCents: number;
    retailerSlug: string;
    url: string;
  }> = [];

  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        setName: p.setName,
        kind: p.kind,
        msrpCents: p.msrpCents,
        releaseDate: new Date(p.releaseDate),
        description: p.description,
      },
    });

    for (const retailerSlug of p.retailers) {
      const retailer = retailerBySlug.get(retailerSlug);
      const config = RETAILERS.find((r) => r.slug === retailerSlug);
      if (!retailer || !config) continue;

      const url = config.search(p.name);
      const listing = await prisma.listing.create({
        data: { productId: product.id, retailerId: retailer.id, url },
      });
      listings.push({
        id: listing.id,
        productSlug: p.slug,
        productName: p.name,
        msrpCents: p.msrpCents,
        retailerSlug,
        url,
      });
      listingCount += 1;
    }
  }
  console.log(`  ${PRODUCTS.length} products, ${listingCount} listings`);

  // Replay the simulator across the last few days using the same diff logic
  // the live runner uses, so the seeded feed is exactly what the app would
  // have produced had it been running.
  const now = Date.now();
  const windows = Math.floor((BACKFILL_HOURS * 60 * 60 * 1000) / WINDOW_MS);
  let eventCount = 0;

  for (const listing of listings) {
    let prior: PriorState = {
      status: STOCK_STATUS.UNKNOWN as StockStatus,
      priceCents: null,
      hasBeenChecked: false,
    };
    // Tracked across the whole replay: a listing that restocked two hours ago
    // should say so, not "never".
    let lastInStockAt: Date | null = null;

    for (let i = windows; i >= 0; i--) {
      const at = new Date(now - i * WINDOW_MS);
      const result = simulate(
        {
          listingId: listing.id,
          url: listing.url,
          sku: null,
          retailerSlug: listing.retailerSlug,
          productSlug: listing.productSlug,
          productName: listing.productName,
          msrpCents: listing.msrpCents,
        },
        at,
      );

      const draft = diffCheck(prior, result, listing.msrpCents);
      if (draft) {
        await prisma.stockEvent.create({
          data: {
            listingId: listing.id,
            kind: draft.kind,
            status: draft.status,
            priceCents: draft.priceCents,
            prevPriceCents: draft.prevPriceCents,
            msrpCents: draft.msrpCents,
            atRetail: draft.atRetail,
            createdAt: at,
          },
        });
        eventCount += 1;
      }

      if (result.status === STOCK_STATUS.IN_STOCK) lastInStockAt = at;

      prior = {
        status: result.status,
        priceCents: result.priceCents ?? prior.priceCents,
        hasBeenChecked: true,
      };

      if (i === 0) {
        await prisma.listing.update({
          where: { id: listing.id },
          data: {
            status: result.status,
            priceCents: prior.priceCents,
            lastCheckedAt: at,
            lastInStockAt,
          },
        });
      }
    }
  }
  console.log(`  ${eventCount} stock events across the last ${BACKFILL_HOURS}h`);

  const demoProduct = await prisma.product.findUnique({
    where: { slug: "prismatic-evolutions-elite-trainer-box" },
  });
  if (demoProduct) {
    await prisma.watch.create({
      data: {
        email: "demo@restockradar.dev",
        productId: demoProduct.id,
        token: randomBytes(24).toString("hex"),
      },
    });
    console.log("  1 demo watch (demo@restockradar.dev)");
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
