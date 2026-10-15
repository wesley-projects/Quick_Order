"""Load and validate the YAML config file."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

_ENV_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")

CHECKER_TYPES = {"shopify", "html"}


class ConfigError(ValueError):
    pass


@dataclass
class Settings:
    default_interval_seconds: int = 300
    min_interval_seconds: int = 60
    per_domain_gap_seconds: float = 5.0
    request_timeout_seconds: float = 20.0
    user_agent: str = "pokemon-tcg-monitor/0.1 (personal stock alerts)"
    respect_robots_txt: bool = True
    state_file: str = "state.json"
    alert_on_first_check: bool = True


@dataclass
class Product:
    name: str
    url: str
    checker: str = "html"
    interval_seconds: int | None = None
    max_price: float | None = None
    # html checker options
    in_stock_selector: str | None = None
    price_selector: str | None = None
    in_stock_text: list[str] = field(default_factory=list)
    out_of_stock_text: list[str] = field(
        default_factory=lambda: ["sold out", "out of stock", "unavailable"]
    )


@dataclass
class NotifierConfig:
    type: str
    options: dict[str, Any] = field(default_factory=dict)


@dataclass
class Config:
    settings: Settings
    products: list[Product]
    notifiers: list[NotifierConfig]

    def interval_for(self, product: Product) -> int:
        interval = product.interval_seconds or self.settings.default_interval_seconds
        return max(interval, self.settings.min_interval_seconds)


def _expand_env(value: Any) -> Any:
    if isinstance(value, str):
        return _ENV_PATTERN.sub(lambda m: os.environ.get(m.group(1), ""), value)
    if isinstance(value, list):
        return [_expand_env(v) for v in value]
    if isinstance(value, dict):
        return {k: _expand_env(v) for k, v in value.items()}
    return value


def _as_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    return [str(v) for v in value]


def parse_config(raw: dict[str, Any]) -> Config:
    raw = _expand_env(raw or {})

    settings_raw = raw.get("settings") or {}
    known = Settings.__dataclass_fields__.keys()
    unknown = set(settings_raw) - set(known)
    if unknown:
        raise ConfigError(f"Unknown settings: {', '.join(sorted(unknown))}")
    settings = Settings(**settings_raw)
    if settings.min_interval_seconds < 30:
        raise ConfigError("min_interval_seconds must be at least 30 to avoid hammering sites")

    products: list[Product] = []
    for i, p in enumerate(raw.get("products") or []):
        if not p.get("name") or not p.get("url"):
            raise ConfigError(f"Product #{i + 1} needs a name and url")
        checker = p.get("checker", "html")
        if checker not in CHECKER_TYPES:
            raise ConfigError(f"Product {p['name']!r}: checker must be one of {sorted(CHECKER_TYPES)}")
        product = Product(
            name=p["name"],
            url=p["url"],
            checker=checker,
            interval_seconds=p.get("interval_seconds"),
            max_price=p.get("max_price"),
            in_stock_selector=p.get("in_stock_selector"),
            price_selector=p.get("price_selector"),
            in_stock_text=_as_list(p.get("in_stock_text")),
        )
        if "out_of_stock_text" in p:
            product.out_of_stock_text = _as_list(p["out_of_stock_text"])
        products.append(product)
    if not products:
        raise ConfigError("Config has no products to monitor")

    notifiers: list[NotifierConfig] = []
    for n in raw.get("notifiers") or [{"type": "console"}]:
        n = dict(n)
        notifiers.append(NotifierConfig(type=n.pop("type"), options=n))

    return Config(settings=settings, products=products, notifiers=notifiers)


def load_config(path: str | Path) -> Config:
    with open(path, encoding="utf-8") as f:
        return parse_config(yaml.safe_load(f))
