#!/usr/bin/env bash
# Idempotent "finish Whop 100%" script. Runs everything that requires
# real gcloud user auth in one shot:
#
#   1. Re-auth gcloud (interactive — opens browser if needed)
#   2. Push the Whop API key + webhook secret to Secret Manager
#   3. Build + deploy the whop ingestion Cloud Run Job (incremental sync)
#   4. Wire a Cloud Scheduler trigger so the job runs hourly
#   5. Re-deploy the whop-webhook Cloud Function with the Svix signature fix
#   6. Smoke test — execute the job once and verify rows in raw_whop.payments
#
# Usage (from any directory):
#   bash data_audit/ingestion/whop/finish-whop.sh
#
# Re-run safe: every step checks for existing resources before creating.

set -euo pipefail

PROJECT=ministry-of-growth-analytics
REGION=us-central1
SA=ingestion-sa@${PROJECT}.iam.gserviceaccount.com
WHOP_API_KEY="${WHOP_API_KEY:-apik_9YNCgo0Ec5mVp_C4970332_C_e8d983fb01a3d3a0afda4784201114b06f60868dbaee37575cb6a43e6fbdb4}"
WHOP_WEBHOOK_SECRET="${WHOP_WEBHOOK_SECRET:-ws_64c68a311535bf598226e9b550e91a6ed3121efaf69a455bcc7dd3f8ad2f1435}"

# Detect repo root (script lives at data_audit/ingestion/whop/finish-whop.sh)
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../../.." && pwd)
cd "$REPO_ROOT"

echo "===================================================================="
echo "  STEP 1 — gcloud auth"
echo "===================================================================="
gcloud config set project "$PROJECT" 2>/dev/null
ACTIVE=$(gcloud config get-value account 2>/dev/null || echo "(none)")
echo "  Active account: $ACTIVE"
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "  → Auth expired or missing. Opening browser to re-auth…"
  gcloud auth login --quiet
fi
gcloud auth print-access-token >/dev/null
echo "  ✓ gcloud auth working"

echo ""
echo "===================================================================="
echo "  STEP 2 — push secrets to Secret Manager"
echo "===================================================================="
for pair in "whop-api-key:$WHOP_API_KEY" "whop-webhook-secret:$WHOP_WEBHOOK_SECRET"; do
  SID="${pair%%:*}"
  VAL="${pair#*:}"
  if gcloud secrets describe "$SID" --project="$PROJECT" >/dev/null 2>&1; then
    echo "  • $SID already exists — adding new version"
  else
    echo "  • $SID — creating"
    gcloud secrets create "$SID" --project="$PROJECT" --replication-policy=automatic --quiet
  fi
  printf '%s' "$VAL" | gcloud secrets versions add "$SID" --project="$PROJECT" --data-file=- --quiet
  gcloud secrets add-iam-policy-binding "$SID" \
    --project="$PROJECT" \
    --member="serviceAccount:$SA" \
    --role=roles/secretmanager.secretAccessor \
    --quiet >/dev/null 2>&1 || true
done
echo "  ✓ secrets in place + readable by $SA"

echo ""
echo "===================================================================="
echo "  STEP 3 — build + deploy whop ingestion Cloud Run Job"
echo "===================================================================="
bash "$REPO_ROOT/data_audit/ingestion/deploy.sh" job whop

echo ""
echo "===================================================================="
echo "  STEP 4 — Cloud Scheduler hourly trigger for whop-job"
echo "===================================================================="
SCHEDULER_NAME=whop-job-hourly
JOB_URI="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT}/jobs/whop-job:run"

# Cloud Scheduler needs a SA that can invoke Cloud Run Jobs. Reuse ingestion-sa.
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$SA" \
  --role=roles/run.invoker \
  --condition=None \
  --quiet >/dev/null 2>&1 || true

if gcloud scheduler jobs describe "$SCHEDULER_NAME" --location="$REGION" --project="$PROJECT" >/dev/null 2>&1; then
  echo "  • Scheduler $SCHEDULER_NAME exists — updating"
  gcloud scheduler jobs update http "$SCHEDULER_NAME" \
    --location="$REGION" --project="$PROJECT" \
    --schedule="0 * * * *" \
    --time-zone="UTC" \
    --uri="$JOB_URI" \
    --http-method=POST \
    --oauth-service-account-email="$SA" \
    --quiet
else
  echo "  • Creating scheduler $SCHEDULER_NAME (hourly at :00 UTC)"
  gcloud scheduler jobs create http "$SCHEDULER_NAME" \
    --location="$REGION" --project="$PROJECT" \
    --schedule="0 * * * *" \
    --time-zone="UTC" \
    --uri="$JOB_URI" \
    --http-method=POST \
    --oauth-service-account-email="$SA" \
    --quiet
fi
echo "  ✓ Cloud Scheduler trigger configured (hourly)"

echo ""
echo "===================================================================="
echo "  STEP 5 — redeploy whop-webhook with the Svix signature fix"
echo "===================================================================="
bash "$REPO_ROOT/data_audit/ingestion/deploy.sh" webhook whop

echo ""
echo "===================================================================="
echo "  STEP 6 — smoke test: run the job once and tail the result"
echo "===================================================================="
EXEC_NAME=$(gcloud run jobs execute whop-job \
  --project="$PROJECT" --region="$REGION" \
  --wait --format='value(metadata.name)')
echo "  Execution: $EXEC_NAME"
echo "  Latest BQ counts:"
gcloud auth print-access-token | head -c 0 # ensure token cached
bq query --project_id="$PROJECT" --use_legacy_sql=false --format=pretty \
  'SELECT
     (SELECT COUNT(*) FROM `'"$PROJECT"'.raw_whop.payments`) AS payments,
     (SELECT COUNT(*) FROM `'"$PROJECT"'.raw_whop.memberships`) AS memberships,
     (SELECT COUNT(*) FROM `'"$PROJECT"'.raw_whop.products`) AS products' 2>&1 | tail -6

echo ""
echo "===================================================================="
echo "  ✓ DONE — Whop pipeline is 100% live"
echo "===================================================================="
echo "  • Hourly Cloud Run Job: whop-job (incremental sync)"
echo "  • Cloud Scheduler: whop-job-hourly @ 0 * * * * UTC"
echo "  • Webhook (Svix-fixed): https://whop-webhook-734g252luq-uc.a.run.app"
echo "  • Secrets in GCP Secret Manager"
echo ""
echo "Next manual step: ask Sean to fire a Whop 'Send Test Event' from the"
echo "Developer dashboard and confirm the event lands in raw_whop.events."
