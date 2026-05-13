# Calendly webhook system

Owner: Shahriar
Last updated: 2026-05-13

The receiver, BQ ledger, and lib are all built. **The subscription itself is not yet created** — Calendly is not currently sending us any events. Follow this doc to turn it on when ready.

---

## What's already in place

| Piece | Where |
|---|---|
| Webhook receiver endpoint | `POST /api/webhooks/calendly` |
| Ledger table | `no-more-mondays-analytics.nmm_calendar.calendly_webhook_events` (created on first delivery via `CREATE IF NOT EXISTS`) |
| Insert + signature-verify helpers | `lib/calendly-webhooks.ts` |
| Public URL once deployed | `https://apps.nomoremondays.io/api/webhooks/calendly` (or the `.vercel.app` URL while DNS pending) |

The endpoint verifies every request's HMAC signature, parses the envelope, and inserts one row per delivery into BQ. Idempotent on Calendly's delivery `id` — retries don't duplicate.

---

## To turn it on (one-time setup)

### 1. Generate a signing key

```bash
openssl rand -hex 32
# e.g. 4f9a8b7c2d1e0f3a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a
```

Save this somewhere safe (1Password / Vercel team note). You'll need it twice — for the Calendly subscription, and for our env.

### 2. Add it to Vercel env

```bash
vercel env add CALENDLY_WEBHOOK_SIGNING_KEY production
# paste the hex from step 1 when prompted
vercel env add CALENDLY_WEBHOOK_SIGNING_KEY preview
vercel env add CALENDLY_WEBHOOK_SIGNING_KEY development
# Redeploy to pick it up:
vercel --prod
```

### 3. Create the Calendly subscription

The existing `CALENDLY_PAT` in Vercel env has admin scope and `webhooks:write`. We can pull it locally and create the subscription:

```bash
# Pull the prod env to your local
vercel env pull /tmp/nmm-env.local --environment=production --yes

# Extract the PAT
CALENDLY_PAT=$(grep -E '^CALENDLY_PAT=' /tmp/nmm-env.local | sed 's/CALENDLY_PAT="//;s/"$//')

# Get the org URI (we already know this but re-fetching keeps this script self-contained)
ORG=$(curl -sS "https://api.calendly.com/users/me" \
  -H "Authorization: Bearer $CALENDLY_PAT" | python3 -c "import sys,json; print(json.load(sys.stdin)['resource']['current_organization'])")

# Create the subscription
curl -sS -X POST "https://api.calendly.com/webhook_subscriptions" \
  -H "Authorization: Bearer $CALENDLY_PAT" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://apps.nomoremondays.io/api/webhooks/calendly\",
    \"events\": [
      \"invitee.created\",
      \"invitee.canceled\",
      \"invitee_no_show.created\",
      \"invitee_no_show.deleted\"
    ],
    \"organization\": \"$ORG\",
    \"scope\": \"organization\",
    \"signing_key\": \"PASTE_YOUR_HEX_HERE\"
  }"

# Clean up
rm /tmp/nmm-env.local
```

A 201 response means it's live. Calendly will start POSTing to our endpoint within seconds.

### 4. Verify

```bash
# Hit the endpoint with GET — should return a friendly ok json
curl https://apps.nomoremondays.io/api/webhooks/calendly

# Then trigger a real event (book or cancel a test call in Calendly).
# Within ~3 seconds, a row should appear:
bq query --use_legacy_sql=false \
  'SELECT event_type, occurred_at, calendly_event_uri
   FROM `no-more-mondays-analytics.nmm_calendar.calendly_webhook_events`
   ORDER BY received_at DESC LIMIT 5'
```

---

## Managing subscriptions

```bash
# List
curl -sS "https://api.calendly.com/webhook_subscriptions?organization=$ORG&scope=organization" \
  -H "Authorization: Bearer $CALENDLY_PAT" | python3 -m json.tool

# Delete a subscription
curl -X DELETE "https://api.calendly.com/webhook_subscriptions/<UUID>" \
  -H "Authorization: Bearer $CALENDLY_PAT"
```

---

## What we're capturing

Schema of `nmm_calendar.calendly_webhook_events`:

| Column | Type | Notes |
|---|---|---|
| `id` | STRING | UUID we mint on receive |
| `event_type` | STRING | e.g. `invitee.created` |
| `calendly_event_uri` | STRING | URI of the scheduled event (nullable) |
| `invitee_uri` | STRING | URI of the invitee (nullable) |
| `occurred_at` | TIMESTAMP | Calendly's `created_at` from the envelope |
| `received_at` | TIMESTAMP | When our endpoint accepted the delivery |
| `payload` | STRING | Full raw JSON of `payload` field |
| `signature_valid` | BOOL | Always `true` for inserted rows (invalid sigs are 401'd, never inserted) |

Partitioned by `DATE(received_at)`, clustered by `event_type, calendly_event_uri` — cheap queries by date range or by specific event.

---

## Available event types

Calendly currently emits 5 webhook event types. We're set up to handle all of them; pick which to subscribe to in step 3 above.

| Event | Fires when |
|---|---|
| `invitee.created` | someone books a call |
| `invitee.canceled` | a booking is canceled (most useful — the "instant" cancellation signal) |
| `invitee_no_show.created` | invitee marked as no-show |
| `invitee_no_show.deleted` | no-show mark removed |
| `routing_form_submission.created` | routing form submitted |

There is no `event.canceled` webhook because Calendly's data model is invitee-centric — when a host kills a slot, every invitee on it gets `invitee.canceled` separately.

---

## Wiring the dashboard later

Once events are flowing into `calendly_webhook_events`, the Funnel Search dashboard can stop hitting Calendly's REST API on every page load and read from the BQ mirror instead. Two benefits:

1. **No more 90-day chunked pagination** — the BQ table has everything.
2. **No rate limit risk** — we own the data.

The swap is in `app/apps/calendly-search/lib/search.ts`. Replace the `apiFetch` proxy calls with a BQ query against the mirror. The mirror would need a small backfill (pull the last ~6 months once via the existing Calendly API), but ongoing data comes free via webhooks.

Not done yet — flagged as future work.
