import json

import pytest

from tcg_monitor.checkers import parse_html, parse_price, parse_shopify, shopify_json_url
from tcg_monitor.config import Product


def product(**kw) -> Product:
    return Product(name="Test", url="https://shop.test/p", **kw)


@pytest.mark.parametrize("text,expected", [
    ("$49.99", 49.99),
    ("Price: $1,299.00 USD", 1299.0),
    ("CA$ 54", 54.0),
    ("Sold out", None),
    (None, None),
])
def test_parse_price(text, expected):
    assert parse_price(text) == expected


def test_shopify_json_url_strips_query_and_adds_js():
    assert shopify_json_url("https://s.com/products/etb/?variant=1") == "https://s.com/products/etb.js"
    assert shopify_json_url("https://s.com/products/etb.js") == "https://s.com/products/etb.js"


def test_parse_shopify_in_stock_uses_cheapest_available_variant():
    body = json.dumps({
        "title": "Prismatic ETB",
        "available": True,
        "variants": [
            {"available": False, "price": 4000},
            {"available": True, "price": 5999},
            {"available": True, "price": 6999},
        ],
    })
    r = parse_shopify(body)
    assert r.in_stock and r.price == 59.99 and r.title == "Prismatic ETB"


def test_parse_shopify_sold_out():
    body = json.dumps({"available": False, "variants": [{"available": False, "price": 5999}]})
    r = parse_shopify(body)
    assert not r.in_stock and r.price == 59.99


def test_html_selector_mode():
    html = '<button class="add-to-cart">Add</button><span class="price">$54.99</span>'
    r = parse_html(html, product(in_stock_selector="button.add-to-cart:not([disabled])", price_selector=".price"))
    assert r.in_stock and r.price == 54.99

    html = '<button class="add-to-cart" disabled>Add</button>'
    assert not parse_html(html, product(in_stock_selector="button.add-to-cart:not([disabled])")).in_stock


def test_html_jsonld_mode():
    ld = {"@context": "https://schema.org", "@type": "Product", "name": "ETB",
          "offers": {"@type": "Offer", "price": "49.99", "availability": "https://schema.org/InStock"}}
    html = f'<script type="application/ld+json">{json.dumps(ld)}</script><p>sold out elsewhere</p>'
    r = parse_html(html, product())
    assert r.in_stock and r.price == 49.99

    ld["offers"]["availability"] = "https://schema.org/OutOfStock"
    html = f'<script type="application/ld+json">{json.dumps(ld)}</script>'
    assert not parse_html(html, product()).in_stock


def test_html_jsonld_graph():
    ld = {"@graph": [{"@type": "Product", "offers": [{"availability": "InStock", "price": 10}]}]}
    html = f'<script type="application/ld+json">{json.dumps(ld)}</script>'
    assert parse_html(html, product()).in_stock


def test_html_text_fallback():
    assert not parse_html("<p>This item is SOLD OUT</p>", product()).in_stock
    assert parse_html("<p>Add to cart</p>", product()).in_stock
    # Phrases inside scripts must not count.
    assert parse_html("<script>var s='sold out'</script><p>Buy now</p>", product()).in_stock
    assert parse_html("<p>Add to cart</p>", product(in_stock_text=["add to cart"])).in_stock
    assert not parse_html("<p>Notify me</p>", product(in_stock_text=["add to cart"])).in_stock
