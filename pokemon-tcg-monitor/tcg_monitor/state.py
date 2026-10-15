"""Remember the last known stock/price per product so we only alert on changes."""

from __future__ import annotations

import json
import os
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from .checkers import CheckResult
from .config import Product
from .notifiers import Alert


@dataclass
class ProductState:
    in_stock: bool
    price: float | None
    last_checked: float


class StateStore:
    def __init__(self, path: str | Path | None):
        self.path = Path(path) if path else None
        self.data: dict[str, ProductState] = {}
        if self.path and self.path.exists():
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            self.data = {k: ProductState(**v) for k, v in raw.items()}

    def save(self) -> None:
        if not self.path:
            return
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps({k: asdict(v) for k, v in self.data.items()}, indent=2))
        os.replace(tmp, self.path)

    def update(self, product: Product, result: CheckResult, alert_on_first_check: bool) -> Alert | None:
        """Record a result and return an alert if something worth knowing changed."""
        prev = self.data.get(product.url)
        self.data[product.url] = ProductState(result.in_stock, result.price, time.time())

        if not result.in_stock:
            return None
        if product.max_price is not None and result.price is not None and result.price > product.max_price:
            return None

        if prev is None:
            if alert_on_first_check:
                return Alert("in_stock", product.name, product.url, result.price)
            return None
        if not prev.in_stock:
            return Alert("restock", product.name, product.url, result.price)
        if prev.price is not None and result.price is not None and result.price < prev.price:
            return Alert("price_drop", product.name, product.url, result.price, prev.price)
        return None
