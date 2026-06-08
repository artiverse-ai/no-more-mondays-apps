"""Whop config."""

from __future__ import annotations

BQ_DATASET = "raw_whop"
API_BASE = "https://api.whop.com/api/v1"

SECRET_API_KEY = "whop-api-key"               # Company API Key
SECRET_WEBHOOK_SECRET = "whop-webhook-secret" # for HMAC verification

ENV_API_KEY = "WHOP_API_KEY"
ENV_WEBHOOK_SECRET = "WHOP_WEBHOOK_SECRET"

COMPANY_ID = None  # set via env if needed; most company-key endpoints derive it
