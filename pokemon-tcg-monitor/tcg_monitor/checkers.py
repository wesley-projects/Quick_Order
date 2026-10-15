"""Turn a fetched product page into a stock/price result."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

from bs4 import BeautifulSoup

from .config import Product

_PRICE_PATTERN = re.compile(r"(\d{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)")


@dataclass
class CheckResult:
    in_stock: bool
    price: float | None = None
    title: str | None = None


def parse_price(text: str | None) -> float | None:
    if not text:
        return None
    match = _PRICE_PATTERN.search(str(text).replace(" ", " "))
    if not match:
        return None
    try:
        return float(re.sub(r"[,\s]", "", match.group(1)))
    except ValueError:
        return None


# --- Shopify -----------------------------------------------------------------

def shopify_json_url(url: str) -> str:
    """Shopify exposes product data at /products/<handle>.js."""
    parts = urlsplit(url)
    path = parts.path.rstrip("/")
    if not path.endswith(".js"):
        path += ".js"
    return urlunsplit((parts.scheme, parts.netloc, path, "", ""))


def parse_shopify(body: str) -> CheckResult:
    data = json.loads(body)
    variants = data.get("variants") or []
    available = [v for v in variants if v.get("available")]
    in_stock = bool(data.get("available")) or bool(available)
    prices = [v.get("price") for v in (available or variants) if v.get("price") is not None]
    price = min(prices) / 100 if prices else None  # Shopify .js prices are in cents
    return CheckResult(in_stock=in_stock, price=price, title=data.get("title"))


# --- Generic HTML --------------------------------------------------------------

def _iter_jsonld_offers(soup: BeautifulSoup):
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node)
            elif isinstance(node, dict):
                if "@graph" in node:
                    stack.extend(node["@graph"])
                offers = node.get("offers")
                if offers:
                    stack.extend(offers if isinstance(offers, list) else [offers])
                if "availability" in node:
                    yield node


def parse_html(body: str, product: Product) -> CheckResult:
    soup = BeautifulSoup(body, "html.parser")
    title = soup.title.get_text(strip=True) if soup.title else None

    price = None
    if product.price_selector:
        el = soup.select_one(product.price_selector)
        price = parse_price(el.get_text(" ", strip=True) if el else None)

    # 1. Explicit selector wins: element present means in stock.
    if product.in_stock_selector:
        return CheckResult(
            in_stock=soup.select_one(product.in_stock_selector) is not None,
            price=price,
            title=title,
        )

    # 2. Structured data (schema.org Offer.availability) is the most reliable signal.
    offers = list(_iter_jsonld_offers(soup))
    if offers:
        in_stock = any("instock" in str(o.get("availability", "")).lower() for o in offers)
        if price is None:
            for o in offers:
                price = parse_price(o.get("price") or o.get("lowPrice"))
                if price is not None:
                    break
        return CheckResult(in_stock=in_stock, price=price, title=title)

    # 3. Fall back to visible-text phrases.
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True).lower()
    if product.in_stock_text:
        in_stock = any(p.lower() in text for p in product.in_stock_text)
    else:
        in_stock = not any(p.lower() in text for p in product.out_of_stock_text)
    return CheckResult(in_stock=in_stock, price=price, title=title)


def request_url(product: Product) -> str:
    return shopify_json_url(product.url) if product.checker == "shopify" else product.url


def parse_response(body: str, product: Product) -> CheckResult:
    if product.checker == "shopify":
        return parse_shopify(body)
    return parse_html(body, product)
