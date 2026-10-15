"""Where alerts go: console, Discord webhook, or ntfy.sh push notifications."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from .config import NotifierConfig

log = logging.getLogger(__name__)


@dataclass
class Alert:
    kind: str  # "restock" | "price_drop" | "in_stock"
    product_name: str
    url: str
    price: float | None = None
    old_price: float | None = None

    @property
    def headline(self) -> str:
        if self.kind == "price_drop":
            return f"Price drop: {self.product_name}"
        if self.kind == "restock":
            return f"RESTOCK: {self.product_name}"
        return f"In stock: {self.product_name}"

    @property
    def body(self) -> str:
        parts = []
        if self.price is not None:
            if self.old_price is not None:
                parts.append(f"${self.old_price:.2f} -> ${self.price:.2f}")
            else:
                parts.append(f"${self.price:.2f}")
        parts.append(self.url)
        return "\n".join(parts)


class Notifier:
    async def send(self, alert: Alert, client: httpx.AsyncClient) -> None:
        raise NotImplementedError


class ConsoleNotifier(Notifier):
    async def send(self, alert: Alert, client: httpx.AsyncClient) -> None:
        print(f"\a*** {alert.headline} ***\n{alert.body}\n", flush=True)


class DiscordNotifier(Notifier):
    def __init__(self, webhook_url: str, mention: str | None = None):
        if not webhook_url:
            raise ValueError("discord notifier needs webhook_url (is DISCORD_WEBHOOK_URL set?)")
        self.webhook_url = webhook_url
        self.mention = mention

    async def send(self, alert: Alert, client: httpx.AsyncClient) -> None:
        color = 0x2ECC71 if alert.kind != "price_drop" else 0xF1C40F
        payload = {
            "content": self.mention or None,
            "embeds": [{
                "title": alert.headline,
                "url": alert.url,
                "description": alert.body,
                "color": color,
            }],
        }
        resp = await client.post(self.webhook_url, json=payload)
        resp.raise_for_status()


class NtfyNotifier(Notifier):
    def __init__(self, topic: str, server: str = "https://ntfy.sh"):
        if not topic:
            raise ValueError("ntfy notifier needs a topic")
        self.url = f"{server.rstrip('/')}/{topic}"

    async def send(self, alert: Alert, client: httpx.AsyncClient) -> None:
        resp = await client.post(
            self.url,
            content=alert.body.encode(),
            headers={"Title": alert.headline, "Click": alert.url, "Priority": "high", "Tags": "zap"},
        )
        resp.raise_for_status()


def build_notifiers(configs: list[NotifierConfig]) -> list[Notifier]:
    notifiers: list[Notifier] = []
    for cfg in configs:
        if cfg.type == "console":
            notifiers.append(ConsoleNotifier())
        elif cfg.type == "discord":
            notifiers.append(DiscordNotifier(**cfg.options))
        elif cfg.type == "ntfy":
            notifiers.append(NtfyNotifier(**cfg.options))
        else:
            raise ValueError(f"Unknown notifier type: {cfg.type}")
    return notifiers


async def broadcast(alert: Alert, notifiers: list[Notifier], client: httpx.AsyncClient) -> None:
    for n in notifiers:
        try:
            await n.send(alert, client)
        except Exception as exc:  # one broken notifier shouldn't stop the others
            log.error("%s failed: %s", type(n).__name__, exc)
