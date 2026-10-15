import json

import httpx
import pytest

from tcg_monitor.checkers import CheckResult
from tcg_monitor.config import ConfigError, Product, parse_config
from tcg_monitor.monitor import FetchError, Monitor, PoliteFetcher
from tcg_monitor.notifiers import Alert, Notifier
from tcg_monitor.state import StateStore


def make_config(tmp_path, **settings):
    return parse_config({
        "settings": {"state_file": str(tmp_path / "state.json"), "per_domain_gap_seconds": 0, **settings},
        "products": [{"name": "ETB", "url": "https://shop.test/products/etb", "checker": "shopify"}],
    })


class Recorder(Notifier):
    def __init__(self):
        self.alerts: list[Alert] = []

    async def send(self, alert, client):
        self.alerts.append(alert)


# --- config ------------------------------------------------------------------

def test_config_enforces_min_interval(tmp_path):
    cfg = make_config(tmp_path, min_interval_seconds=60)
    cfg.products[0].interval_seconds = 5
    assert cfg.interval_for(cfg.products[0]) == 60


def test_config_rejects_too_aggressive_floor(tmp_path):
    with pytest.raises(ConfigError):
        make_config(tmp_path, min_interval_seconds=5)


def test_config_expands_env(monkeypatch, tmp_path):
    monkeypatch.setenv("HOOK", "https://discord.test/hook")
    cfg = parse_config({
        "products": [{"name": "x", "url": "https://a.test"}],
        "notifiers": [{"type": "discord", "webhook_url": "${HOOK}"}],
    })
    assert cfg.notifiers[0].options["webhook_url"] == "https://discord.test/hook"


def test_config_rejects_unknown_checker():
    with pytest.raises(ConfigError):
        parse_config({"products": [{"name": "x", "url": "https://a.test", "checker": "magic"}]})


# --- state transitions -------------------------------------------------------

def test_state_alerts_only_on_changes(tmp_path):
    store = StateStore(tmp_path / "s.json")
    p = Product(name="ETB", url="https://a.test")

    assert store.update(p, CheckResult(False, 50.0), True) is None
    assert store.update(p, CheckResult(True, 50.0), True).kind == "restock"
    assert store.update(p, CheckResult(True, 50.0), True) is None
    drop = store.update(p, CheckResult(True, 45.0), True)
    assert drop.kind == "price_drop" and drop.old_price == 50.0
    assert store.update(p, CheckResult(True, 48.0), True) is None  # price rise: quiet

    store.save()
    reloaded = StateStore(tmp_path / "s.json")
    assert reloaded.data["https://a.test"].price == 48.0


def test_state_first_check_and_max_price(tmp_path):
    store = StateStore(None)
    p = Product(name="ETB", url="https://a.test", max_price=60)
    assert store.update(p, CheckResult(True, 80.0), True) is None  # too expensive
    assert store.update(p, CheckResult(True, 59.0), True).kind == "price_drop"

    quiet = StateStore(None)
    assert quiet.update(Product(name="x", url="https://b.test"), CheckResult(True, 1.0), False) is None


# --- fetching ----------------------------------------------------------------

def shopify_body(available: bool) -> str:
    return json.dumps({"title": "ETB", "available": available,
                       "variants": [{"available": available, "price": 5499}]})


async def test_monitor_check_once_sends_restock(tmp_path):
    responses = iter([shopify_body(False), shopify_body(True)])
    seen_urls = []

    def handler(request: httpx.Request):
        seen_urls.append(str(request.url))
        return httpx.Response(200, text=next(responses))

    cfg = make_config(tmp_path)
    rec = Recorder()
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        mon = Monitor(cfg, [rec], client)
        await mon.check_once(cfg.products[0])
        await mon.check_once(cfg.products[0])

    assert seen_urls == ["https://shop.test/products/etb.js"] * 2
    assert [a.kind for a in rec.alerts] == ["restock"]
    assert rec.alerts[0].price == 54.99


async def test_fetcher_raises_with_retry_after_on_429(tmp_path):
    cfg = make_config(tmp_path)
    transport = httpx.MockTransport(lambda r: httpx.Response(429, headers={"Retry-After": "120"}))
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(FetchError) as exc:
            await PoliteFetcher(client, cfg).get("https://shop.test/x")
    assert exc.value.retry_after == 120


async def test_fetcher_respects_robots(tmp_path):
    cfg = make_config(tmp_path)

    def handler(request: httpx.Request):
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /private/\n")
        return httpx.Response(200, text="ok")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        f = PoliteFetcher(client, cfg)
        assert await f.allowed("https://shop.test/products/etb")
        assert not await f.allowed("https://shop.test/private/etb")


async def test_missing_robots_allows_everything(tmp_path):
    cfg = make_config(tmp_path)
    transport = httpx.MockTransport(lambda r: httpx.Response(404))
    async with httpx.AsyncClient(transport=transport) as client:
        assert await PoliteFetcher(client, cfg).allowed("https://shop.test/anything")
