"""Shared Cloud Function webhook receiver primitives.

Each platform's webhook function uses:
    from data_audit.ingestion.common.webhook import insert_event
    @functions_framework.http
    def handler(request):
        ... verify signature ...
        insert_event(dataset, 'events', payload, id_key='id', event_type_key='type')
        return ('OK', 200)
"""

from __future__ import annotations

import datetime as dt
import json
from typing import Any

from google.cloud import bigquery

from . import config

# Webhook events go into a single `events` table per platform, partitioned by
# day. Each row keeps the full raw payload + a few extracted fields for
# routing/filtering.
WEBHOOK_EVENT_SCHEMA = [
    bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("event_type", "STRING"),
    bigquery.SchemaField("payload", "JSON"),
    bigquery.SchemaField("received_at", "TIMESTAMP", mode="REQUIRED"),
]


def _client() -> bigquery.Client:
    return bigquery.Client(project=config.GCP_PROJECT)


def ensure_events_table(dataset: str, table: str = "events") -> str:
    table_id = f"{config.GCP_PROJECT}.{dataset}.{table}"
    cli = _client()
    try:
        cli.get_dataset(f"{config.GCP_PROJECT}.{dataset}")
    except Exception:
        ds = bigquery.Dataset(f"{config.GCP_PROJECT}.{dataset}")
        ds.location = config.BQ_LOCATION
        cli.create_dataset(ds, exists_ok=True)
    t = bigquery.Table(table_id, schema=WEBHOOK_EVENT_SCHEMA)
    t.time_partitioning = bigquery.TimePartitioning(
        type_=bigquery.TimePartitioningType.DAY, field="received_at"
    )
    cli.create_table(t, exists_ok=True)
    return table_id


def insert_event(
    dataset: str,
    payload: dict[str, Any],
    *,
    event_id: str,
    event_type: str | None = None,
    table: str = "events",
) -> None:
    """Append a single webhook event via a one-row load job (sandbox-safe).

    Webhooks are append-only — no dedup needed. If the same event arrives
    twice (rare, e.g. our 200 didn't reach the platform), dbt downstream
    handles dedup on event_id.
    """
    table_id = ensure_events_table(dataset, table)
    row = {
        "id": event_id,
        "event_type": event_type,
        "payload": json.dumps(payload),
        "received_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }
    cli = _client()
    job_config = bigquery.LoadJobConfig(
        schema=WEBHOOK_EVENT_SCHEMA,
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
    )
    cli.load_table_from_json([row], table_id, job_config=job_config).result()
