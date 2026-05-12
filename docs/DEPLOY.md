# Deploy — Vercel + BigQuery

This repo is a single Next.js 16 app. One Vercel project hosts everything;
the calendar route queries BigQuery live via a service-account key.

## 1. Create the Vercel project

1. Vercel → Add New → Project → import `artiverse-ai/no-more-mondays-apps`.
2. Framework preset: **Next.js** (auto-detected).
3. Build & output: leave defaults. Vercel infers pnpm from `pnpm-lock.yaml`.
4. Deploy. The first deploy will succeed but `/apps/calendar` will 500 until
   env vars are set in step 2.

## 2. Environment variables

In **Project Settings → Environment Variables**, add these keys for both
**Production** and **Preview**:

| Key                                    | Value                                                              |
| -------------------------------------- | ------------------------------------------------------------------ |
| `BQ_PROJECT`                           | `no-more-mondays-analytics`                                        |
| `BQ_DATASET`                           | `nmm_calendar`                                                     |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON`  | Full SA JSON key, pasted as one string                             |
| `CALENDLY_PAT`                         | Admin Calendly Personal Access Token (org-scoped)                  |
| `CLOUDFLARE_API_TOKEN`                 | CF token: Account → Access: Edit; Zone → DNS: Edit                 |
| `CF_ACCOUNT_ID`                        | No More Mondays Cloudflare account id                              |
| `CF_ACCESS_GROUP_ID`                   | UUID of the `nmm-allowed-emails` Cloudflare Access Group           |
| `ADMIN_EMAILS`                         | Comma-separated emails that can use `/admin`                       |
| `CUSTOM_DOMAIN`                        | `apps.nomoremondays.io` — the CF-fronted hostname                  |
| `SKIP_AUTH` (temp)                     | `1` during initial deploys before CF Access is wired; unset later  |

The service account needs:

- `roles/bigquery.dataViewer` on the `nmm_calendar` dataset (calendar app)
- `roles/bigquery.dataViewer` on the `dbt_tuddin` dataset (webinar dashboard —
  `/dashboards/webinar` reads `mart_webinar_events` + `int_calls_enriched`)
- `roles/bigquery.jobUser` on the `no-more-mondays-analytics` project

(`BQ_PROJECT` / `BQ_DATASET` only steer the calendar app's queries; the webinar
dashboard is hard-coded to `no-more-mondays-analytics.dbt_tuddin`.)

You can use the existing
`shahriar-s-service-account@no-more-mondays-analytics.iam.gserviceaccount.com`
(already provisioned with these grants) or mint a new one. To export its key:

```bash
gcloud config configurations activate nmm-analytics
gcloud iam service-accounts keys create ./sa-key.json \
  --iam-account=shahriar-s-service-account@no-more-mondays-analytics.iam.gserviceaccount.com
# paste the file contents into the Vercel env var, then delete the local file
shred -u ./sa-key.json
```

Redeploy after setting the env vars (Vercel will prompt).

## 3. Auth — Vercel Authentication

Under **Project Settings → Deployment Protection**:

- Enable **Vercel Authentication** for both Production and Preview.
- Viewers will need a Vercel account on the team. To invite teammates without
  giving them deploy access, add them as **Viewers** under
  Team Settings → Members.

Switch to Cloudflare Access or Clerk later if Vercel's built-in auth becomes
limiting.

## 4. Custom domain (optional)

`apps.nomoremondays.io` or similar — added under **Project → Domains**.
Vercel handles the cert.

## Local development

```bash
pnpm install
cp .env.local.example .env.local
# Fill in the same three values.
pnpm dev
# http://localhost:3000
```

Alternative for local dev: instead of pasting the SA JSON into
`.env.local`, you can authenticate with Application Default Credentials and
omit `GOOGLE_APPLICATION_CREDENTIALS_JSON`:

```bash
gcloud config configurations activate nmm-analytics
gcloud auth application-default login \
  --account=shahriar.sourav@turing.com   # any account with NMM access
# then `pnpm dev` — lib/bq.ts falls back to ADC when the env var is missing.
```

## Useful local commands

```bash
# Which gcloud config am I on?
gcloud config configurations list

# Switch to NMM
gcloud config configurations activate nmm-analytics

# Sanity-check BQ access
bq ls --project_id=no-more-mondays-analytics

# Restore your other-work config
gcloud config configurations activate work-dw
```
