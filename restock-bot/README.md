# Pokémon Card Restock Bot

Watches product pages you choose and notifies you when a Pokémon TCG product is
**back in stock at or below retail (MSRP)**. Scalper-priced listings are ignored.

It only watches and notifies. It does not add to cart or check out.

Uses only the Python standard library (3.9+), so there's nothing to install.

## Setup

1. Copy the example config:
   ```bash
   cp config.example.json config.json
   ```
2. Pick at least one way to get notified:
   - **Phone push (easiest):** install the free [ntfy](https://ntfy.sh) app, subscribe to a
     hard-to-guess topic name (e.g. `pkmn-restock-k39fz`), and put that name in `notify.ntfy_topic`.
   - **Discord:** Server Settings → Integrations → Webhooks → New Webhook → copy the URL into
     `notify.discord_webhook`.
3. Replace `products` with the product pages you want to watch, along with each one's MSRP.
   `tolerance` is optional. `0.05` means it still alerts up to 5% over MSRP, which helps with tax-inclusive or rounded prices.
4. Test it:
   ```bash
   python3 restock_bot.py --test-notify                  # should ping your phone/Discord
   python3 restock_bot.py --check-url "<product url>"    # shows what the bot can read from the page
   ```
5. Run it:
   ```bash
   python3 restock_bot.py            # loops forever, checking every interval_seconds (default 300)
   python3 restock_bot.py --once     # single pass, for cron / Task Scheduler
   ```

You get **one** alert each time an item becomes a deal. It won't ping again until
the item sells out (or goes above retail) and then comes back.

## How it detects stock

For each page, in order:
1. **schema.org JSON-LD** `Offer` data (`price` + `availability`). Most store pages include this, and it is the most reliable signal.
2. **Meta tags** (`product:price:amount`, `product:availability`).
3. **Keyword fallback**: "sold out" / "out of stock" vs. "add to cart".

If a page shows as in stock but the bot can't find a price, it won't alert by default,
because it can't tell retail from scalper pricing. Set `"require_price": false` to alert anyway.

## Caveats

- **Run `--check-url` on every product first.** Some big retailers (Target, Walmart,
  Pokémon Center) build their pages with JavaScript or block automated requests. If
  `--check-url` shows `unknown` or the fetch fails, the bot can't watch that page reliably.
  Use a different retailer's listing for the same product, or that store's own app alerts.
- Keep `interval_seconds` reasonable (≥ 120). Checking too often can get your IP rate-limited.
- Respect each site's terms of use.

## Tests

```bash
python3 -m unittest -v
```
