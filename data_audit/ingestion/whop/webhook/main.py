"""Whop webhook receiver — Cloud Function (gen2 HTTPS).

Whop signs webhooks with **Svix** (https://docs.svix.com/receiving/verifying-payloads/how-manual).
The secret starts with `ws_` (or older `whsec_`) which is the base64-encoded
HMAC key.

Verification steps (Svix protocol):
    1. Read headers:  whop-signature, whop-id, whop-timestamp
       (older alias: svix-signature, svix-id, svix-timestamp)
    2. Decode the secret: strip the `ws_`/`whsec_` prefix → base64-decode → raw key bytes
    3. Build the signed content as the ASCII string `{id}.{timestamp}.{body}`
    4. Compute HMAC-SHA256 over that content with the raw key, base64-encode
    5. The header may contain multiple space-separated `v1,<sig>` entries —
       accept if ANY matches in constant time
    6. (Optional) reject if timestamp is more than 5 minutes from now to mitigate replay

Why we got this wrong the first time: we naively hex-HMAC'd just the body
with the raw secret string. Every legit Whop event 401'd silently.

Deploy:
    gcloud functions deploy whop-webhook \\
      --gen2 --runtime=python312 --region=us-central1 \\
      --source=data_audit/ingestion/whop/webhook \\
      --entry-point=handler \\
      --trigger-http --allow-unauthenticated \\
      --service-account=ingestion-sa@...iam.gserviceaccount.com \\
      --set-env-vars=USE_SECRET_MANAGER=1
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

import functions_framework

from data_audit.ingestion.common import secrets, webhook
from data_audit.ingestion.whop import config

# Tolerate up to 5 minutes of clock skew between Whop and us (Svix default).
MAX_TIMESTAMP_SKEW_SECONDS = 300


def _decode_secret(raw: str) -> bytes:
    """Strip the Svix `ws_`/`whsec_` prefix and base64-decode to raw HMAC key."""
    for prefix in ("ws_", "whsec_"):
        if raw.startswith(prefix):
            raw = raw[len(prefix):]
            break
    # Svix uses base64; pad if missing
    padding = (4 - len(raw) % 4) % 4
    return base64.b64decode(raw + "=" * padding)


def _verify_svix(body: bytes, msg_id: str | None, msg_ts: str | None, header_sig: str | None) -> bool:
    """Verify a Svix-format webhook signature header.

    Header format: one or more space-separated entries like `v1,<base64sig>`.
    Returns True if ANY entry matches.
    """
    secret = os.environ.get(config.ENV_WEBHOOK_SECRET) or secrets.get(
        config.SECRET_WEBHOOK_SECRET, env_fallback=config.ENV_WEBHOOK_SECRET
    )
    if not secret:
        print("[warn] no webhook secret configured — skipping verify", flush=True)
        return True
    if not (msg_id and msg_ts and header_sig):
        print(f"[verify] missing field id={bool(msg_id)} ts={bool(msg_ts)} sig={bool(header_sig)}", flush=True)
        return False

    # Optional replay protection
    try:
        ts_int = int(msg_ts)
        if abs(time.time() - ts_int) > MAX_TIMESTAMP_SKEW_SECONDS:
            print(f"[verify] timestamp skew too large: now={time.time():.0f} got={ts_int}", flush=True)
            return False
    except ValueError:
        return False

    try:
        key = _decode_secret(secret)
    except Exception as e:
        print(f"[verify] cannot decode secret: {e}", flush=True)
        return False

    signed_content = f"{msg_id}.{msg_ts}.".encode() + body
    expected_b64 = base64.b64encode(hmac.new(key, signed_content, hashlib.sha256).digest()).decode()

    # Header may contain multiple "v1,<sig>" entries separated by spaces
    for entry in header_sig.split():
        parts = entry.split(",", 1)
        if len(parts) != 2:
            continue
        version, sig_b64 = parts
        if version != "v1":
            continue
        if hmac.compare_digest(expected_b64, sig_b64):
            return True

    print(f"[verify] no signature in header matched; expected v1,{expected_b64[:8]}...", flush=True)
    return False


def _hdr(request, *names: str) -> str | None:
    """Return the first matching header value (case-insensitive)."""
    for n in names:
        v = request.headers.get(n)
        if v:
            return v
    return None


@functions_framework.http
def handler(request):
    body_bytes = request.get_data()

    # Whop wraps Svix — they may use `whop-*` or pass through `svix-*`.
    msg_id = _hdr(request, "whop-id", "svix-id")
    msg_ts = _hdr(request, "whop-timestamp", "svix-timestamp")
    msg_sig = _hdr(request, "whop-signature", "svix-signature")

    if not _verify_svix(body_bytes, msg_id, msg_ts, msg_sig):
        return ("invalid signature", 401)

    try:
        payload = json.loads(body_bytes)
    except Exception:
        return ("invalid json", 400)

    event_id = (
        msg_id
        or payload.get("id")
        or payload.get("data", {}).get("id")
    )
    event_type = payload.get("type") or payload.get("event")
    if not event_id:
        return ("missing event id", 400)

    webhook.insert_event(
        config.BQ_DATASET, payload,
        event_id=str(event_id), event_type=event_type,
    )
    return ("ok", 200)
