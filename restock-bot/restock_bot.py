#!/usr/bin/env python3
"""Pokemon TCG restock notifier.

Watches product pages you list in config.json and pings you (Discord and/or
ntfy.sh phone push) when an item comes back in stock at or below retail (MSRP).

Stdlib only -- no pip install needed. Run `python3 restock_bot.py --help`.
"""
from __future__ import annotations

import argparse
import html
import json
import logging
import random
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

log = logging.getLogger("restock_bot")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0 Safari/537.36"
)

IN_STOCK, OUT_OF_STOCK, UNKNOWN = "in_stock", "out_of_stock", "unknown"

# schema.org availability values -> our three states
_AVAILABILITY = {
    "instock": IN_STOCK,
    "onlineonly": IN_STOCK,
    "limitedavailability": IN_STOCK,
    "instoreonly": IN_STOCK,
    "preorder": IN_STOCK,
    "presale": IN_STOCK,
    "backorder": OUT_OF_STOCK,
    "outofstock": OUT_OF_STOCK,
    "soldout": OUT_OF_STOCK,
    "discontinued": OUT_OF_STOCK,
}

_OUT_PHRASES = ("out of stock", "sold out", "currently unavailable", "coming soon", "notify me when available")
_IN_PHRASES = ("add to cart", "add to bag", "add to basket")


@dataclass
class Product:
    name: str
    url: str
    msrp: float
    tolerance: float = 0.0  # allowed overage, e.g. 0.05 = 5% above MSRP still alerts

    @property
    def max_price(self) -> float:
        return round(self.msrp * (1 + self.tolerance), 2)


@dataclass
class Status:
    availability: str
    price: float | None
    source: str  # which signal decided it: json-ld, meta, keywords, none


# ---------------------------------------------------------------- parsing

def _walk(node: Any) -> Iterable[dict]:
    """Yield every dict in a JSON-LD tree (handles @graph, lists, nesting)."""
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from _walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from _walk(v)


def _to_price(value: Any) -> float | None:
    if value is None:
        return None
    m = re.search(r"\d+(?:[.,]\d{1,2})?", str(value).replace(",", ""))
    return float(m.group(0)) if m else None


def _norm_availability(value: Any) -> str:
    if not value:
        return UNKNOWN
    key = str(value).rsplit("/", 1)[-1].replace("_", "").replace(" ", "").lower()
    return _AVAILABILITY.get(key, UNKNOWN)


def parse_json_ld(page: str) -> Status | None:
    blocks = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        page, flags=re.S | re.I,
    )
    offers: list[dict] = []
    for raw in blocks:
        try:
            data = json.loads(html.unescape(raw.strip()))
        except json.JSONDecodeError:
            continue
        for node in _walk(data):
            types = node.get("@type")
            types = types if isinstance(types, list) else [types]
            if any(t in ("Offer", "AggregateOffer") for t in types):
                offers.append(node)
    if not offers:
        return None

    # Prefer an in-stock offer with the lowest price.
    best: Status | None = None
    for o in offers:
        avail = _norm_availability(o.get("availability"))
        price = _to_price(o.get("price") or o.get("lowPrice"))
        cand = Status(avail, price, "json-ld")
        if best is None:
            best = cand
        elif cand.availability == IN_STOCK and best.availability != IN_STOCK:
            best = cand
        elif cand.availability == best.availability and price is not None and (
            best.price is None or price < best.price
        ):
            best = cand
    return best


def _meta(page: str, prop: str) -> str | None:
    for pattern in (
        rf'<meta[^>]+(?:property|name|itemprop)=["\']{re.escape(prop)}["\'][^>]+content=["\']([^"\']*)["\']',
        rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name|itemprop)=["\']{re.escape(prop)}["\']',
    ):
        m = re.search(pattern, page, flags=re.I)
        if m:
            return html.unescape(m.group(1))
    return None


def parse_meta(page: str) -> Status | None:
    price = _to_price(
        _meta(page, "product:price:amount") or _meta(page, "og:price:amount") or _meta(page, "price")
    )
    avail = _norm_availability(
        _meta(page, "product:availability") or _meta(page, "og:availability") or _meta(page, "availability")
    )
    if price is None and avail == UNKNOWN:
        return None
    return Status(avail, price, "meta")


def parse_keywords(page: str) -> Status:
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", page, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text).lower()
    if any(p in text for p in _OUT_PHRASES):
        return Status(OUT_OF_STOCK, None, "keywords")
    if any(p in text for p in _IN_PHRASES):
        return Status(IN_STOCK, None, "keywords")
    return Status(UNKNOWN, None, "none")


def parse_page(page: str) -> Status:
    """Combine signals: structured data first, keyword scan as a last resort."""
    ld, meta = parse_json_ld(page), parse_meta(page)
    status = ld or meta or parse_keywords(page)
    if status.price is None:
        for other in (ld, meta):
            if other and other.price is not None:
                status = Status(status.availability, other.price, status.source)
                break
    if status.availability == UNKNOWN:
        kw = parse_keywords(page)
        status = Status(kw.availability, status.price, f"{status.source}+keywords")
    return status


# ---------------------------------------------------------------- network

def fetch(url: str, timeout: float = 20) -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def _post(url: str, body: bytes, headers: dict[str, str]) -> None:
    req = urllib.request.Request(url, data=body, headers={"User-Agent": "restock-bot", **headers}, method="POST")
    with urllib.request.urlopen(req, timeout=15):
        pass


def notify(cfg: dict, title: str, message: str, url: str | None = None) -> None:
    n = cfg.get("notify", {})
    sent = False
    if n.get("discord_webhook"):
        content = f"**{title}**\n{message}" + (f"\n{url}" if url else "")
        try:
            _post(n["discord_webhook"], json.dumps({"content": content}).encode(),
                  {"Content-Type": "application/json"})
            sent = True
        except urllib.error.URLError as e:
            log.error("Discord notify failed: %s", e)
    if n.get("ntfy_topic"):
        server = n.get("ntfy_server", "https://ntfy.sh").rstrip("/")
        headers = {"Title": title.encode("ascii", "ignore").decode(), "Priority": "high", "Tags": "rotating_light"}
        if url:
            headers["Click"] = url
        try:
            _post(f"{server}/{n['ntfy_topic']}", message.encode(), headers)
            sent = True
        except urllib.error.URLError as e:
            log.error("ntfy notify failed: %s", e)
    if not sent:
        log.warning("No notifier delivered (configure notify.discord_webhook or notify.ntfy_topic)")
    print(f"\a[ALERT] {title} - {message} {url or ''}", flush=True)


# ---------------------------------------------------------------- main loop

def load_products(cfg: dict) -> list[Product]:
    return [Product(p["name"], p["url"], float(p["msrp"]), float(p.get("tolerance", 0))) for p in cfg["products"]]


def is_deal(product: Product, status: Status, require_price: bool) -> bool:
    if status.availability != IN_STOCK:
        return False
    if status.price is None:
        return not require_price
    return status.price <= product.max_price


def check_all(cfg: dict, state: dict) -> dict:
    require_price = cfg.get("require_price", True)
    for product in load_products(cfg):
        try:
            status = parse_page(fetch(product.url))
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            log.warning("%s: fetch failed (%s)", product.name, e)
            continue

        deal = is_deal(product, status, require_price)
        price_txt = f"${status.price:.2f}" if status.price is not None else "price ?"
        log.info("%-40s %-12s %-10s (%s)%s", product.name[:40], status.availability, price_txt,
                 status.source, "  <-- DEAL" if deal else "")

        was_deal = state.get(product.url, {}).get("deal", False)
        if deal and not was_deal:
            notify(cfg, f"RESTOCK: {product.name}",
                   f"In stock at {price_txt} (MSRP ${product.msrp:.2f})", product.url)
        state[product.url] = {"deal": deal, "availability": status.availability,
                              "price": status.price, "checked": int(time.time())}
        time.sleep(random.uniform(1.5, 4))  # be polite between requests
    return state


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Notify on Pokemon card restocks at retail price.")
    ap.add_argument("--config", default=str(Path(__file__).with_name("config.json")))
    ap.add_argument("--state", default=str(Path(__file__).with_name("state.json")))
    ap.add_argument("--once", action="store_true", help="check once and exit (for cron)")
    ap.add_argument("--test-notify", action="store_true", help="send a test notification and exit")
    ap.add_argument("--check-url", metavar="URL", help="show what the bot sees on one page and exit")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s", datefmt="%H:%M:%S")

    if args.check_url:
        s = parse_page(fetch(args.check_url))
        print(f"availability={s.availability} price={s.price} source={s.source}")
        return 0

    cfg = json.loads(Path(args.config).read_text())
    if args.test_notify:
        notify(cfg, "Restock bot test", "Notifications are working!", None)
        return 0

    state_path = Path(args.state)
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    interval = int(cfg.get("interval_seconds", 300))

    while True:
        state = check_all(cfg, state)
        state_path.write_text(json.dumps(state, indent=2))
        if args.once:
            return 0
        time.sleep(interval + random.uniform(0, interval * 0.2))


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(0)
