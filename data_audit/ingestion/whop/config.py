"""Whop config.

Company API keys (apik_*) authenticate against the v5 company-scoped
endpoints. We tested v1 and v2 — v1 returns 400, v2 works for
payments/memberships/products only. v5 is the current canonical surface
and includes single-record fetches we use for the webhook reconciliation
flow, so default to v5.
"""

from __future__ import annotations

BQ_DATASET = "raw_whop"
API_BASE = "https://api.whop.com/api/v5/company"

SECRET_API_KEY = "whop-api-key"               # Company API Key
SECRET_WEBHOOK_SECRET = "whop-webhook-secret" # for Svix HMAC verification

ENV_API_KEY = "WHOP_API_KEY"
ENV_WEBHOOK_SECRET = "WHOP_WEBHOOK_SECRET"

COMPANY_ID = None  # company-scoped key derives this server-side
