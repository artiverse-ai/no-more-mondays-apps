"""Credential storage with local-file and GCP Secret Manager backends.

Same interface — `get(id)`, `put(id, value)`. Local-file is for laptop dev
(no billing required). Secret Manager kicks in once Cloud Run is deployed.
"""

from __future__ import annotations

import json
import os
import pathlib
from typing import Any

from . import config

LOCAL_PATH = pathlib.Path(
    os.environ.get("INGESTION_SECRETS_FILE",
                   str(pathlib.Path.home() / ".ingestion_secrets.json"))
)


def _local_read() -> dict[str, Any]:
    if not LOCAL_PATH.exists():
        return {}
    return json.loads(LOCAL_PATH.read_text())


def _local_write(data: dict[str, Any]) -> None:
    LOCAL_PATH.write_text(json.dumps(data, indent=2))
    try:
        os.chmod(LOCAL_PATH, 0o600)
    except OSError:
        pass


def get(secret_id: str, env_fallback: str | None = None) -> str:
    if env_fallback and os.environ.get(env_fallback):
        return os.environ[env_fallback]
    if config.USE_SECRET_MANAGER:
        from google.cloud import secretmanager
        cli = secretmanager.SecretManagerServiceClient()
        name = f"projects/{config.GCP_PROJECT}/secrets/{secret_id}/versions/latest"
        resp = cli.access_secret_version(request={"name": name})
        return resp.payload.data.decode("utf-8")
    data = _local_read()
    if secret_id not in data:
        raise KeyError(
            f"secret '{secret_id}' not found in {LOCAL_PATH}. "
            f"Set it via env var {env_fallback or '(none)'} or run "
            f"`python -m data_audit.ingestion.common.secrets put <id> <value>`."
        )
    return data[secret_id]


def put(secret_id: str, value: str) -> None:
    if config.USE_SECRET_MANAGER:
        from google.cloud import secretmanager
        cli = secretmanager.SecretManagerServiceClient()
        parent = f"projects/{config.GCP_PROJECT}"
        try:
            cli.create_secret(request={
                "parent": parent,
                "secret_id": secret_id,
                "secret": {"replication": {"automatic": {}}},
            })
        except Exception as e:
            if "already exists" not in str(e).lower():
                raise
        cli.add_secret_version(request={
            "parent": f"{parent}/secrets/{secret_id}",
            "payload": {"data": value.encode("utf-8")},
        })
        return
    data = _local_read()
    data[secret_id] = value
    _local_write(data)


def main() -> int:
    """CLI: `python -m data_audit.ingestion.common.secrets put <id> <value>`"""
    import sys
    if len(sys.argv) < 3 or sys.argv[1] not in ("put", "get"):
        print("usage: secrets put <id> <value> | get <id>", file=sys.stderr)
        return 1
    if sys.argv[1] == "put":
        if len(sys.argv) < 4:
            print("usage: secrets put <id> <value>", file=sys.stderr)
            return 1
        put(sys.argv[2], sys.argv[3])
        print(f"stored {sys.argv[2]} in {'Secret Manager' if config.USE_SECRET_MANAGER else LOCAL_PATH}")
        return 0
    print(get(sys.argv[2]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
