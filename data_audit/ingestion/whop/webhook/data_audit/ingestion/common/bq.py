"""Generic BigQuery writer for raw_* datasets.

Pattern: each entity becomes a table with shape
    (id STRING REQUIRED, payload JSON, updated_at TIMESTAMP, ingested_at TIMESTAMP REQUIRED)
optionally augmented with a few caller-supplied "extracted" columns for
filtering speed (e.g. owner_uri, event_type_uri for Calendly).

Why JSON + extracted columns rather than typed columns:
- Source schemas drift (Calendly adds fields, Whop renames). JSON keeps full
  fidelity; dbt downstream extracts typed columns into mart tables.
- Idempotency via MERGE on `id`. Re-runs reconcile without duplicates.

Why load jobs (not streaming inserts):
- BQ sandbox / free tier blocks `insertAll`. Load jobs are allowed.
- For our volumes (1-100k rows per pull) the latency difference is negligible.
- We stage to a temp table via load job, then MERGE into the target table.
"""

from __future__ import annotations

import datetime as dt
import json
from typing import Any, Iterable

from google.cloud import bigquery

from . import config

_client: bigquery.Client | None = None


def client() -> bigquery.Client:
    global _client
    if _client is None:
        _client = bigquery.Client(project=config.GCP_PROJECT)
    return _client


def _table_id(dataset: str, entity: str) -> str:
    return f"{config.GCP_PROJECT}.{dataset}.{entity}"


def ensure_dataset(dataset: str) -> None:
    cli = client()
    ds_ref = f"{config.GCP_PROJECT}.{dataset}"
    try:
        cli.get_dataset(ds_ref)
    except Exception:
        ds = bigquery.Dataset(ds_ref)
        ds.location = config.BQ_LOCATION
        cli.create_dataset(ds, exists_ok=True)


def ensure_table(
    dataset: str,
    entity: str,
    extracted_columns: list[bigquery.SchemaField] | None = None,
) -> str:
    """Create `<dataset>.<entity>` if missing. `extracted_columns` are
    nullable typed columns extracted from the JSON payload for fast filtering.
    Returns FQ table id.
    """
    table_id = _table_id(dataset, entity)
    schema = [
        bigquery.SchemaField("id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("payload", "JSON"),
        bigquery.SchemaField("updated_at", "TIMESTAMP"),
        bigquery.SchemaField("ingested_at", "TIMESTAMP", mode="REQUIRED"),
    ]
    schema.extend(extracted_columns or [])
    table = bigquery.Table(table_id, schema=schema)
    table.time_partitioning = bigquery.TimePartitioning(
        type_=bigquery.TimePartitioningType.DAY, field="ingested_at"
    )
    client().create_table(table, exists_ok=True)
    return table_id


def upsert(
    dataset: str,
    entity: str,
    records: Iterable[dict[str, Any]],
    *,
    id_fn,
    updated_at_fn=None,
    extracted_fns: dict[str, Any] | None = None,
) -> int:
    """MERGE records into `<dataset>.<entity>`.

    Args:
      id_fn: callable(record) -> str. The unique key.
      updated_at_fn: optional callable(record) -> ISO timestamp str.
      extracted_fns: optional dict of {column_name: callable(record) -> value}
        for the extracted typed columns. Column names must match
        `extracted_columns` passed to ensure_table.

    Returns: rows merged.
    """
    extracted_fns = extracted_fns or {}
    extracted_columns = [
        bigquery.SchemaField(name, "STRING") for name in extracted_fns
    ]
    table_id = ensure_table(dataset, entity, extracted_columns)
    cli = client()

    rows = []
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    for r in records:
        rid = id_fn(r)
        if not rid:
            continue
        row = {
            "id": str(rid),
            # JSON column: load-job expects the value as a serialized JSON
            # string. (Streaming insert wanted the same shape, so this is
            # carrier-compatible.)
            "payload": json.dumps(r),
            "updated_at": updated_at_fn(r) if updated_at_fn else None,
            "ingested_at": now,
        }
        for col, fn in extracted_fns.items():
            row[col] = fn(r)
        rows.append(row)
    if not rows:
        return 0

    tmp_id = f"{table_id}__stage_{int(dt.datetime.now().timestamp())}"
    tmp_schema = cli.get_table(table_id).schema
    tmp = bigquery.Table(tmp_id, schema=tmp_schema)
    tmp.expires = dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1)
    cli.create_table(tmp)

    job_config = bigquery.LoadJobConfig(
        schema=tmp_schema,
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    load_job = cli.load_table_from_json(rows, tmp_id, job_config=job_config)
    try:
        load_job.result()
    except Exception:
        cli.delete_table(tmp_id, not_found_ok=True)
        raise

    extracted_set_clause = "".join(
        f",\n        {col} = S.{col}" for col in extracted_fns
    )
    extracted_insert_cols = "".join(f", {col}" for col in extracted_fns)
    extracted_insert_vals = "".join(f", S.{col}" for col in extracted_fns)

    merge_sql = f"""
      MERGE `{table_id}` T
      USING `{tmp_id}` S
      ON T.id = S.id
      WHEN MATCHED THEN UPDATE SET
        payload = S.payload,
        updated_at = S.updated_at,
        ingested_at = S.ingested_at{extracted_set_clause}
      WHEN NOT MATCHED THEN
        INSERT (id, payload, updated_at, ingested_at{extracted_insert_cols})
        VALUES (S.id, S.payload, S.updated_at, S.ingested_at{extracted_insert_vals})
    """
    cli.query(merge_sql).result()
    cli.delete_table(tmp_id, not_found_ok=True)
    return len(rows)
