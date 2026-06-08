"""Pull payments (all statuses) from Whop v5.

The v5 API returns timestamps as Unix integers (e.g. `created_at: 1780850426`)
but our BQ `updated_at` column is TIMESTAMP, so we have to convert.
"""

from __future__ import annotations

import datetime as dt
import os

from ...common import bq
from .. import config
from ..client import WhopClient


def _to_iso(ts) -> str | None:
    """Whop v5 timestamps are unix int seconds; convert to ISO for BQ."""
    if ts is None:
        return None
    try:
        return dt.datetime.fromtimestamp(int(ts), tz=dt.timezone.utc).isoformat()
    except (ValueError, TypeError, OSError):
        return None


def _since() -> int | None:
    days = os.environ.get("WHOP_LOOKBACK_DAYS")
    if not days:
        return None
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=int(days))
    return int(cutoff.timestamp())


def run(cli: WhopClient) -> int:
    params = {}
    since = _since()
    if since:
        params["created_after"] = since
    records = list(cli.paginate("/payments", params=params, items_key="data"))
    return bq.upsert(
        config.BQ_DATASET, "payments",
        records,
        id_fn=lambda r: str(r["id"]),
        updated_at_fn=lambda r: _to_iso(r.get("paid_at") or r.get("created_at")),
        extracted_fns={
            "user_id":       lambda r: str(r.get("user_id") or ""),
            "user_email":    lambda r: r.get("user_email"),
            "user_username": lambda r: r.get("user_username"),
            "membership_id": lambda r: str(r.get("membership_id") or ""),
            "product_id":    lambda r: str(r.get("product_id") or ""),
            "status":        lambda r: r.get("status"),
            "currency":      lambda r: r.get("currency"),
            "final_amount":  lambda r: str(r.get("final_amount") or ""),
            "billing_reason": lambda r: r.get("billing_reason"),
        },
    )
