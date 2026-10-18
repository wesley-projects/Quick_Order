import json
import unittest

from restock_bot import IN_STOCK, OUT_OF_STOCK, UNKNOWN, Product, Status, is_deal, parse_page


def ld(obj):
    return f'<html><head><script type="application/ld+json">{json.dumps(obj)}</script></head><body></body></html>'


class ParsePageTests(unittest.TestCase):
    def test_json_ld_in_stock(self):
        s = parse_page(ld({"@type": "Product", "offers": {"@type": "Offer", "price": "49.99",
                                                          "availability": "https://schema.org/InStock"}}))
        self.assertEqual((s.availability, s.price, s.source), (IN_STOCK, 49.99, "json-ld"))

    def test_json_ld_out_of_stock_in_graph(self):
        s = parse_page(ld({"@graph": [{"@type": "Product", "offers": [
            {"@type": "Offer", "price": 49.99, "availability": "http://schema.org/OutOfStock"}]}]}))
        self.assertEqual(s.availability, OUT_OF_STOCK)

    def test_prefers_in_stock_offer(self):
        s = parse_page(ld({"@type": "Product", "offers": [
            {"@type": "Offer", "price": 39.99, "availability": "OutOfStock"},
            {"@type": "Offer", "price": 89.99, "availability": "InStock"}]}))
        self.assertEqual((s.availability, s.price), (IN_STOCK, 89.99))

    def test_meta_tags(self):
        page = ('<meta property="product:price:amount" content="26.94">'
                '<meta property="product:availability" content="in stock">')
        s = parse_page(page)
        self.assertEqual((s.availability, s.price), (IN_STOCK, 26.94))

    def test_keyword_fallback(self):
        self.assertEqual(parse_page("<button>Sold Out</button>").availability, OUT_OF_STOCK)
        self.assertEqual(parse_page("<button>Add to Cart</button>").availability, IN_STOCK)
        self.assertEqual(parse_page("<p>hello</p>").availability, UNKNOWN)

    def test_price_from_ld_with_keyword_availability(self):
        s = parse_page(ld({"@type": "Offer", "price": "$1,049.99"}) + "<button>Add to cart</button>")
        self.assertEqual((s.availability, s.price), (IN_STOCK, 1049.99))


class DealTests(unittest.TestCase):
    p = Product("ETB", "u", 49.99, tolerance=0.05)

    def test_at_or_under_retail(self):
        self.assertTrue(is_deal(self.p, Status(IN_STOCK, 49.99, "x"), True))
        self.assertTrue(is_deal(self.p, Status(IN_STOCK, 52.49, "x"), True))  # within 5%

    def test_scalper_price(self):
        self.assertFalse(is_deal(self.p, Status(IN_STOCK, 119.99, "x"), True))

    def test_out_of_stock(self):
        self.assertFalse(is_deal(self.p, Status(OUT_OF_STOCK, 49.99, "x"), True))

    def test_unknown_price(self):
        self.assertFalse(is_deal(self.p, Status(IN_STOCK, None, "x"), True))
        self.assertTrue(is_deal(self.p, Status(IN_STOCK, None, "x"), False))


if __name__ == "__main__":
    unittest.main()
