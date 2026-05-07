# NMM Analytics Dashboard (v0)

A static dashboard for `mart_webinar_events` with drill-through to per-webinar
call records from `int_calls_enriched`. Pure HTML + vanilla JS + Tailwind/Chart.js
via CDN — no build step.

## Files

```
dashboard/
  index.html              entry; loads app.js + CDNs
  app.js                  all logic (overview + detail views, charts, filters)
  data/
    webinar_events.json   snapshot of mart_webinar_events
    calls.json            snapshot of int_calls_enriched (since 2025-11-01)
  scripts/
    refresh-data.ps1      regenerate data/*.json from BigQuery (uses `bq` CLI)
```

## Local preview

```powershell
python -m http.server 5174 --directory dashboard --bind 127.0.0.1
# open http://127.0.0.1:5174
```

## Refreshing the data

The dashboard reads JSON snapshots committed to the repo. To pull fresh
numbers:

```powershell
# requires gcloud SDK + `bq` CLI auth'd to no-more-mondays-analytics
pwsh dashboard/scripts/refresh-data.ps1
git add dashboard/data
git commit -m "refresh dashboard snapshot"
git push
```

Cloudflare auto-rebuilds within a minute.

> Until the script is wired to your local `bq` CLI auth, you can also have
> Claude regenerate the JSONs by re-running the BQ MCP queries used for the
> initial seed and then committing.

## Cloudflare Pages deploy

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → pick this repo.
2. Build settings:
   - **Production branch**: `main`
   - **Build command**: *(leave empty)*
   - **Build output directory**: `dashboard`
3. Deploy. You'll get `https://<name>.pages.dev`.

(Optional) Add a custom domain `analytics.nomoremondays.io` from
**Pages project → Custom domains**.

## Auth — Cloudflare Access (required before sharing the URL)

The data is private. Lock the site behind email auth before linking it:

1. Cloudflare Dashboard → **Zero Trust** → **Access** → **Applications** →
   **Add an application** → **Self-hosted**.
2. Application name: `NMM Analytics`.
3. Application domain: the Pages URL (`<name>.pages.dev` or your custom
   domain).
4. **Identity providers**: enable **One-time PIN** at minimum (works with any
   email — no Google login required). Add Google if you want SSO.
5. **Policies** → Add policy:
   - Action: **Allow**
   - Include rules:
     - **Emails**: `taziem@nomoremondays.io`, `marek@sintano.com`,
       `alvaro@nomoremondays.io`
     - **Email domain**: `nomoremondays.io`
6. Save. The Pages URL will now require a one-time PIN sent to one of those
   addresses before showing the dashboard.

## What's in v0

- Overview page with KPI cards, charts (spend/cash, deals, ROAS, funnel) and
  a sortable table of all 50 webinars.
- Filters: webinar day, data era, date range.
- Click a row → per-webinar detail page with:
  - Marketing / Funnel / Sales metric groups
  - Source breakdown (meta / tiktok / manychat / setter / other)
  - Funnel chart with stage-to-stage conversion %
  - **Drill-through table of call records** for that webinar's booking week
    (matched by `booking_week_sun` + `final_marketing_flow`)
  - Raw mart-row JSON viewer

## What's NOT in v0 (next iterations)

- **Live BigQuery queries** — currently snapshot-based.
- **Per-closer / per-setter performance** — schema is already shipped in
  `calls.json`, just needs a new `/sales` route.
- **Calendly availability** — separate feature, requires Calendly API.
- **Funnel attribution polish** — Post-Attendee Typeform calls show on both
  Sun and Wed pages within the same week (we don't have `calendly_created_ts`
  in the snapshot to do day-of-week split).

## Known caveats

- Tailwind Play CDN warns in console — fine for v0; swap to a built CSS file
  in a later iteration.
- Page is `<meta name="robots" content="noindex,nofollow">` but the actual
  privacy comes from Cloudflare Access — make sure that's enabled before
  sharing the URL.
