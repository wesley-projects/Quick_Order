# Pokémon TCG Monitor

A bot that keeps checking store pages for Pokémon TCG products and alerts you
when one **comes back in stock** or **drops in price**. Alerts go to the
console, a Discord channel (webhook), or your phone (via [ntfy](https://ntfy.sh)).

It only watches and notifies. It never adds to cart or checks out, so you buy
by hand.

## Quick start

```bash
cd pokemon-tcg-monitor
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp config.example.yaml config.yaml # then edit the products list
python -m tcg_monitor check        # one pass, prints stock + price for each product
python -m tcg_monitor test-notify  # make sure your alerts arrive
python -m tcg_monitor run          # watch continuously (Ctrl+C to stop)
```

## Adding products

Each entry in `products:` needs a `name`, a `url` and a `checker`:

| checker   | Use for | How it works |
|-----------|---------|--------------|
| `shopify` | Most independent card shops (URLs look like `/products/...`) | Reads the store's `<url>.js` product JSON: exact stock and price, very cheap. |
| `html`    | Everything else | 1) `in_stock_selector` if you set one, 2) the page's schema.org JSON-LD `availability`, 3) text phrases like "sold out". |

Optional per product:

- `max_price`: alert only at or below this price
- `interval_seconds`: override how often this product is checked
- `in_stock_selector` / `price_selector`: CSS selectors (right-click the Add to Cart button, Inspect)
- `in_stock_text` / `out_of_stock_text`: phrases to look for in the page text

Run `python -m tcg_monitor check` after adding a product to confirm it reads
correctly before you leave it running.

## Alerts

```yaml
notifiers:
  - type: console
  - type: discord
    webhook_url: ${DISCORD_WEBHOOK_URL}   # Server Settings → Integrations → Webhooks
    mention: "@here"
  - type: ntfy
    topic: ${NTFY_TOPIC}                  # pick a long random topic name
```

`${VAR}` values come from environment variables, so secrets stay out of the file.

You get an alert when a product:
- is in stock the first time it is checked (turn off with `alert_on_first_check: false`)
- goes from out of stock to in stock (**restock**)
- gets cheaper while in stock (**price drop**)

Last-known state is saved to `state.json`, so a restart doesn't re-alert.

## Built-in politeness

Checking constantly shouldn't get you blocked or put load on small shops:

- **Minimum interval** (default 60s, config can't go below 30s), plus ±10% jitter
- **Per-site spacing**: requests to the same domain are at least `per_domain_gap_seconds` apart
- **Backoff**: errors double the wait (up to 1h); `429`/`503` honour `Retry-After`
- **robots.txt** is respected by default
- An honest `User-Agent`

Big retailers (Target, Walmart, Pokémon Center, etc.) often run bot protection
or render stock with JavaScript, and their terms may forbid automated access.
Check a site's terms before you monitor it. Shopify-based local game stores
work best.

## Running it 24/7

Any always-on machine works: a Raspberry Pi, a cheap VPS, or a spare PC.
For example, with `tmux`:

```bash
tmux new -s tcg 'python -m tcg_monitor run'
```

## Development

```bash
pip install -r requirements-dev.txt
pytest
```

```
tcg_monitor/
  __main__.py   # CLI: run / check / test-notify
  config.py     # YAML loading + validation
  checkers.py   # Shopify JSON + HTML (selector / JSON-LD / text) parsing
  monitor.py    # polling loop, per-domain rate limiting, robots.txt, backoff
  state.py      # change detection (restock, price drop) + persistence
  notifiers.py  # console, Discord, ntfy
```
