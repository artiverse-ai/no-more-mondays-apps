"""Pull memberships (active + canceled) from Whop v5."""

from __future__ import annotations

import datetime as dt

from ...common import bq
from .. import config
from ..client import WhopClient


def _to_iso(ts) -> str | None:
    if ts is None:
        return None
    try:
        return dt.datetime.fromtimestamp(int(ts), tz=dt.timezone.utc).isoformat()
    except (ValueError, TypeError, OSError):
        return None


def run(cli: WhopClient) -> int:
    records = list(cli.paginate("/memberships", items_key="data"))
    return bq.upsert(
        config.BQ_DATASET, "memberships",
        records,
        id_fn=lambda r: str(r["id"]),
        updated_at_fn=lambda r: _to_iso(r.get("updated_at") or r.get("created_at")),
        extracted_fns={
            "user_id":     lambda r: str(r.get("user_id") or ""),
            "product_id":  lambda r: str(r.get("product_id") or ""),
            "plan_id":     lambda r: str(r.get("plan_id") or ""),
            "status":      lambda r: r.get("status"),
            "valid":       lambda r: str(r.get("valid")) if r.get("valid") is not None else None,
        },
    )
