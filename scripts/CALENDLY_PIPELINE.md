# Calendly → BQ live pipeline

Live mirror of every Calendly invitee event into `nmm_calendar.calendly_events`.

```
Calendly (source)
  │ webhook POST (signed)
  ▼
/api/calendly-webhook  ──INSERT──►  nmm_calendar.calendly_events
                                         ▲
              ┌──────────────────────────┘
              │ (Phase 2) historical backfill
              │
   scripts/backfill-calendly-events.mjs
```

Affects only the **Calendly Call Creation Stats** dashboard. Does NOT touch:
- `nmm_calendar.busy_intervals` (Google Calendar sync via App Script — separate)
- `nmm_calendar.closers` / `team_members`
- `dbt_tuddin.int_calls_enriched` and all dbt models
- The existing Funnel Search app (stays on live Calendly API)

---

## One-time setup (in order)

### 1. Backfill last 30 days

Get a Calendly Personal Access Token from
<https://calendly.com/integrations/api_webhooks> → "Create new token".

```bash
# From your laptop with gcloud authed.
CALENDLY_PAT=<your-pat> \
BQ_PROJECT=no-more-mondays-analytics \
BACKFILL_DAYS_BACK=30 \
BACKFILL_DAYS_FORWARD=730 \
  node scripts/backfill-calendly-events.mjs
```

The first run creates the `calendly_events` table (no separate setup needed —
the webhook handler also creates it on demand). Expect 5–10 minutes for 30
days × ~13 chunks × 2 statuses.

To preview without writing: prepend `DRY_RUN=1`.

To backfill the entire history later:
```bash
BACKFILL_DAYS_BACK=300 BACKFILL_DAYS_FORWARD=730 node scripts/backfill-calendly-events.mjs
```

### 2. Register the webhook with Calendly

```bash
CALENDLY_PAT=<your-pat> \
WEBHOOK_URL=https://no-more-mondays-apps.vercel.app/api/calendly-webhook \
  node scripts/register-calendly-webhook.mjs
```

This prints:
- The subscription URI (save it somewhere — useful for the `delete` action)
- The **signing_key** — you must copy this to Vercel

### 3. Add `CALENDLY_WEBHOOK_SIGNING_KEY` to Vercel

Vercel → Project → Settings → Environment Variables → New:
- Name: `CALENDLY_WEBHOOK_SIGNING_KEY`
- Value: the `signing_key` from step 2
- Environments: Production + Preview + Development

Redeploy so the new env var is picked up.

### 4. Verify

```bash
# Health check (no signature required)
curl https://no-more-mondays-apps.vercel.app/api/calendly-webhook
# Expected: {"ok":true,"signing_key_configured":true,"table":"nmm_calendar.calendly_events"}
```

Then make a test booking in Calendly. Within ~5 seconds it should appear:
```bash
bq query --use_legacy_sql=false --project_id=no-more-mondays-analytics \
  "SELECT invitee_email, event_type_internal_note, invitee_created_at, source
   FROM \`no-more-mondays-analytics.nmm_calendar.calendly_events\`
   WHERE source = 'webhook'
   ORDER BY invitee_created_at DESC
   LIMIT 5"
```

---

## Day-to-day ops

### Manage subscriptions
```bash
# List
ACTION=list CALENDLY_PAT=<pat> node scripts/register-calendly-webhook.mjs

# Delete one
ACTION=delete SUBSCRIPTION_URI=<uri> CALENDLY_PAT=<pat> node scripts/register-calendly-webhook.mjs
```

### Reconciliation cron (recommended, optional)

Daily VM cron that re-runs the last 2 days of the backfill to catch any
webhook deliveries that failed silently. Calendly retries for 24h so this
is belt-and-suspenders.

Add to `weekly-insights-vm` crontab:
```
0 5 * * *  CALENDLY_PAT=<pat> BACKFILL_DAYS_BACK=2 BACKFILL_DAYS_FORWARD=1 node /home/$USER/no-more-mondays-apps/scripts/backfill-calendly-events.mjs
```

(Rows from this run get `source = 'backfill'` instead of `'webhook'` —
not a problem because dashboard reads use the latest version per
`(event_uri, invitee_uri)`.)

---

## Schema

See `lib/calendly-events-table.ts` for the canonical DDL and TypeScript types.

Key columns for the dashboard:
- `invitee_created_at` — primary filter dimension (TIMESTAMP, partitioned by `DATE()`)
- `event_type_internal_note` — funnel tag for filtering (clustered)
- `invitee_email_lc` — for joins / search (clustered)
- `start_time` — when the call is scheduled
- `event_status` / `invitee_canceled` / `is_no_show` — call status derivation
- `hosts` — ARRAY<STRUCT<name, email>> for host filtering
- `raw_payload` — JSON safety net for schema drift

---

## Troubleshooting

**"Invalid signature" on webhook calls**
- Check `CALENDLY_WEBHOOK_SIGNING_KEY` is set in Vercel and matches what
  Calendly returned at subscription-create time.
- The signature has a 5-min replay tolerance — if your server clock is
  badly off, requests will fail.

**Rows missing for events visible in Calendly**
- Check `source` column in BQ — if `webhook` row missing but
  `backfill`/`reconcile` row present, the webhook delivery dropped. Calendly
  retries for 24h so this is rare.
- Verify the event_type's organization scope matches what we subscribed to.

**Backfill is slow**
- Each 60-day chunk paginates if there are >100 events. NMM's volume should
  fit in 1-2 pages per chunk. If you see thousands per chunk, raise
  CONCURRENCY in the script.
