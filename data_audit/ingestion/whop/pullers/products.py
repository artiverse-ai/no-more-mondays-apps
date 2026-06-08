"""Pull products from Whop v5 (catalog — small static list)."""

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
    records = list(cli.paginate("/products", items_key="data"))
    return bq.upsert(
        config.BQ_DATASET, "products",
        records,
        id_fn=lambda r: str(r["id"]),
        updated_at_fn=lambda r: _to_iso(r.get("created_at")),
        extracted_fns={
            "name":       lambda r: r.get("name") or r.get("title"),
            "visibility": lambda r: r.get("visibility"),
            "company_id": lambda r: str(r.get("company_id") or ""),
        },
    )
