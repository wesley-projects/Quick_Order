"""The polling loop: fetch each product on its own schedule, politely."""

from __future__ import annotations

import asyncio
import logging
import random
import time
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

from .checkers import CheckResult, parse_response, request_url
from .config import Config, Product
from .notifiers import Notifier, broadcast
from .state import StateStore

log = logging.getLogger(__name__)

MAX_BACKOFF_SECONDS = 3600


class FetchError(Exception):
    def __init__(self, message: str, retry_after: float | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class PoliteFetcher:
    """Spaces out requests to the same domain and honours robots.txt."""

    def __init__(self, client: httpx.AsyncClient, config: Config):
        self.client = client
        self.settings = config.settings
        self._domain_locks: dict[str, asyncio.Lock] = {}
        self._last_request: dict[str, float] = {}
        self._robots: dict[str, RobotFileParser | None] = {}

    async def _robots_for(self, url: str) -> RobotFileParser | None:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin not in self._robots:
            parser = RobotFileParser()
            try:
                resp = await self.client.get(f"{origin}/robots.txt")
                if resp.status_code >= 400:
                    parser = None  # no robots.txt: everything allowed
                else:
                    parser.parse(resp.text.splitlines())
            except httpx.HTTPError:
                parser = None
            self._robots[origin] = parser
        return self._robots[origin]

    async def allowed(self, url: str) -> bool:
        if not self.settings.respect_robots_txt:
            return True
        parser = await self._robots_for(url)
        return parser is None or parser.can_fetch(self.settings.user_agent, url)

    async def get(self, url: str) -> str:
        domain = urlsplit(url).netloc
        lock = self._domain_locks.setdefault(domain, asyncio.Lock())
        async with lock:
            wait = self._last_request.get(domain, 0) + self.settings.per_domain_gap_seconds - time.monotonic()
            if wait > 0:
                await asyncio.sleep(wait)
            try:
                resp = await self.client.get(url)
            finally:
                self._last_request[domain] = time.monotonic()

        if resp.status_code in (429, 503):
            retry_after = resp.headers.get("Retry-After")
            raise FetchError(
                f"HTTP {resp.status_code} (rate limited)",
                retry_after=float(retry_after) if retry_after and retry_after.isdigit() else None,
            )
        if resp.status_code >= 400:
            raise FetchError(f"HTTP {resp.status_code}")
        return resp.text


async def check_product(fetcher: PoliteFetcher, product: Product) -> CheckResult:
    body = await fetcher.get(request_url(product))
    return parse_response(body, product)


class Monitor:
    def __init__(self, config: Config, notifiers: list[Notifier], client: httpx.AsyncClient):
        self.config = config
        self.notifiers = notifiers
        self.client = client
        self.fetcher = PoliteFetcher(client, config)
        self.state = StateStore(config.settings.state_file)

    async def check_once(self, product: Product) -> CheckResult:
        result = await check_product(self.fetcher, product)
        alert = self.state.update(product, result, self.config.settings.alert_on_first_check)
        self.state.save()
        price = f"${result.price:.2f}" if result.price is not None else "?"
        log.info("%-40s %s  %s", product.name[:40], "IN STOCK " if result.in_stock else "out      ", price)
        if alert:
            await broadcast(alert, self.notifiers, self.client)
        return result

    async def watch(self, product: Product) -> None:
        if not await self.fetcher.allowed(request_url(product)):
            log.warning("robots.txt disallows %s - skipping (set respect_robots_txt: false to override)", product.url)
            return

        base = self.config.interval_for(product)
        # Stagger start times so products on the same site don't all fire at once.
        await asyncio.sleep(random.uniform(0, min(base, 30)))
        failures = 0
        while True:
            delay = base
            try:
                await self.check_once(product)
                failures = 0
            except FetchError as exc:
                failures += 1
                delay = exc.retry_after or min(base * 2 ** failures, MAX_BACKOFF_SECONDS)
                log.warning("%s: %s - next try in %ds", product.name, exc, delay)
            except (httpx.HTTPError, ValueError) as exc:
                failures += 1
                delay = min(base * 2 ** failures, MAX_BACKOFF_SECONDS)
                log.warning("%s: %s - next try in %ds", product.name, exc, delay)
            # +/-10% jitter spreads load instead of hitting on exact boundaries.
            await asyncio.sleep(delay * random.uniform(0.9, 1.1))

    async def run(self) -> None:
        log.info("Watching %d product(s). Ctrl+C to stop.", len(self.config.products))
        await asyncio.gather(*(self.watch(p) for p in self.config.products))


def make_client(config: Config) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        headers={"User-Agent": config.settings.user_agent},
        timeout=config.settings.request_timeout_seconds,
        follow_redirects=True,
    )
