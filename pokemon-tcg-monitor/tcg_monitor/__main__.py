"""Command line entry point: python -m tcg_monitor <command>."""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from .checkers import request_url
from .config import ConfigError, load_config
from .monitor import Monitor, PoliteFetcher, check_product, make_client
from .notifiers import Alert, broadcast, build_notifiers


async def cmd_run(args) -> int:
    config = load_config(args.config)
    notifiers = build_notifiers(config.notifiers)
    async with make_client(config) as client:
        await Monitor(config, notifiers, client).run()
    return 0


async def cmd_check(args) -> int:
    """One pass over every product, printing results. No alerts, no state changes."""
    config = load_config(args.config)
    async with make_client(config) as client:
        fetcher = PoliteFetcher(client, config)
        for product in config.products:
            if not await fetcher.allowed(request_url(product)):
                print(f"SKIPPED   {'':>10}  {product.name}: disallowed by robots.txt")
                continue
            try:
                r = await check_product(fetcher, product)
                price = f"${r.price:.2f}" if r.price is not None else "price ?"
                print(f"{'IN STOCK' if r.in_stock else 'out     '}  {price:>10}  {product.name}")
            except Exception as exc:  # report and keep going
                print(f"ERROR     {'':>10}  {product.name}: {exc}")
    return 0


async def cmd_test_notify(args) -> int:
    config = load_config(args.config)
    notifiers = build_notifiers(config.notifiers)
    alert = Alert("restock", "Test alert from pokemon-tcg-monitor", "https://example.com", 49.99)
    async with make_client(config) as client:
        await broadcast(alert, notifiers, client)
    print(f"Sent test alert to {len(notifiers)} notifier(s).")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="tcg_monitor", description="Pokemon TCG stock & price monitor")
    parser.add_argument("-c", "--config", default="config.yaml", help="path to config file")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("run", help="watch products continuously and send alerts")
    sub.add_parser("check", help="check every product once and print the results")
    sub.add_parser("test-notify", help="send a test alert to every notifier")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)

    handler = {"run": cmd_run, "check": cmd_check, "test-notify": cmd_test_notify}[args.command]
    try:
        return asyncio.run(handler(args))
    except ConfigError as exc:
        print(f"Config error: {exc}", file=sys.stderr)
        return 2
    except FileNotFoundError as exc:
        print(f"{exc}\nCopy config.example.yaml to config.yaml first.", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
