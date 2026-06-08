"""Whop backfill orchestrator (Cloud Run Job entry point)."""

from __future__ import annotations

import sys
import time
import traceback

from ..common import bq
from . import config
from .client import WhopClient
from .pullers import memberships, payments, products

PULLERS = [
    ("products",    products.run),
    ("memberships", memberships.run),
    ("payments",    payments.run),
]


def main() -> int:
    bq.ensure_dataset(config.BQ_DATASET)
    cli = WhopClient()
    failures = 0
    for name, fn in PULLERS:
        t0 = time.monotonic()
        try:
            n = fn(cli)
            print(f"[ok]   {name:18s} merged={n:6d} in {time.monotonic()-t0:.1f}s",
                  flush=True)
        except Exception:
            failures += 1
            print(f"[FAIL] {name:18s} in {time.monotonic()-t0:.1f}s", flush=True)
            traceback.print_exc()
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
