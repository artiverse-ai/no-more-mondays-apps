#!/usr/bin/env bash
# Deploy a Cloud Run Job (calendly|zoom|fanbasis|whop) or a webhook Cloud
# Function (fanbasis-webhook|whop-webhook).
#
# Usage:
#   ./data_audit/ingestion/deploy.sh job calendly
#   ./data_audit/ingestion/deploy.sh job zoom
#   ./data_audit/ingestion/deploy.sh webhook fanbasis
#   ./data_audit/ingestion/deploy.sh webhook whop
#
# Run from repo root.
set -euo pipefail

KIND=${1:?usage: deploy.sh <job|webhook> <module>}
MODULE=${2:?usage: deploy.sh <job|webhook> <module>}

PROJECT=${PROJECT:-ministry-of-growth-analytics}
REGION=${REGION:-us-central1}
SA=${SA:-ingestion-sa@${PROJECT}.iam.gserviceaccount.com}
AR_REPO=${AR_REPO:-ingestion}
AR_HOST=${REGION}-docker.pkg.dev

case "$KIND" in
  job)
    IMAGE="${AR_HOST}/${PROJECT}/${AR_REPO}/${MODULE}-job:latest"
    echo "==> Building ${MODULE}-job"
    # gcloud builds submit needs --config as a file path (stdin/- isn't
    # supported any more). Write the cloudbuild.yaml to a temp file.
    CB_TMP=$(mktemp -t cloudbuild-XXXX.yaml)
    cat > "$CB_TMP" <<EOF
steps:
- name: 'gcr.io/cloud-builders/docker'
  args: ['build', '-f', 'data_audit/ingestion/Dockerfile.job',
         '--build-arg', 'MODULE=${MODULE}',
         '-t', '${IMAGE}', '.']
images:
- '${IMAGE}'
EOF
    gcloud builds submit \
      --project="${PROJECT}" \
      --config="$CB_TMP" \
      .
    rm -f "$CB_TMP"

    echo "==> Deploying Cloud Run Job ${MODULE}-job"
    gcloud run jobs deploy "${MODULE}-job" \
      --project="${PROJECT}" \
      --region="${REGION}" \
      --image="${IMAGE}" \
      --service-account="${SA}" \
      --max-retries=1 \
      --task-timeout=900s \
      --set-env-vars="USE_SECRET_MANAGER=1,GCP_PROJECT=${PROJECT}"

    echo "Done. Run on demand: gcloud run jobs execute ${MODULE}-job --region=${REGION}"
    ;;

  webhook)
    SRC="data_audit/ingestion/${MODULE}/webhook"
    NAME="${MODULE}-webhook"
    echo "==> Deploying Cloud Function ${NAME}"
    # Copy common/ into the function source dir so functions_framework can
    # find it (Cloud Functions only packages files under --source).
    rm -rf "${SRC}/data_audit"
    mkdir -p "${SRC}/data_audit/ingestion/${MODULE}"
    cp data_audit/__init__.py "${SRC}/data_audit/"
    cp data_audit/ingestion/__init__.py "${SRC}/data_audit/ingestion/"
    cp -r data_audit/ingestion/common "${SRC}/data_audit/ingestion/"
    cp data_audit/ingestion/${MODULE}/__init__.py "${SRC}/data_audit/ingestion/${MODULE}/"
    cp data_audit/ingestion/${MODULE}/config.py "${SRC}/data_audit/ingestion/${MODULE}/"

    gcloud functions deploy "${NAME}" \
      --gen2 \
      --project="${PROJECT}" \
      --region="${REGION}" \
      --runtime=python312 \
      --source="${SRC}" \
      --entry-point=handler \
      --trigger-http \
      --allow-unauthenticated \
      --service-account="${SA}" \
      --set-env-vars="USE_SECRET_MANAGER=1,GCP_PROJECT=${PROJECT}"

    # Cleanup local vendor copy so it doesn't pollute git
    rm -rf "${SRC}/data_audit"

    URL=$(gcloud functions describe "${NAME}" \
            --gen2 --project="${PROJECT}" --region="${REGION}" \
            --format='value(serviceConfig.uri)')
    echo "Deployed: ${URL}"
    echo "Register this URL in the ${MODULE} dashboard as your webhook endpoint."
    ;;

  *)
    echo "unknown kind: ${KIND} (expected: job|webhook)" >&2
    exit 1
    ;;
esac
