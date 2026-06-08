"""Cross-platform ingestion config — GCP project, BQ defaults.

Each platform module adds its own platform-specific config on top."""

from __future__ import annotations

import os

GCP_PROJECT = os.environ.get("GCP_PROJECT", "ministry-of-growth-analytics")
BQ_LOCATION = os.environ.get("BQ_LOCATION", "US")

# Default to local-file backed secrets unless the env says otherwise.
# Set GHL_USE_SECRET_MANAGER=1 to switch to GCP Secret Manager (Cloud Run).
USE_SECRET_MANAGER = os.environ.get("USE_SECRET_MANAGER") == "1"
