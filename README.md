# no-more-mondays-apps

Internal apps and dashboards for No More Mondays, deployed as a single Next.js
16 app on Vercel.

## What's in here

```
.
├── app/                            Next.js App Router
│   ├── page.tsx                    Home — Apps & Dashboards sections
│   ├── layout.tsx
│   ├── globals.css                 NMM palette + Tailwind v4
│   └── apps/
│       └── calendar/               Team-availability app (live BigQuery)
│           ├── page.tsx
│           └── team/[email]/page.tsx
├── components/                     UI + chart components (shadcn-based)
├── lib/                            bq client, availability queries, helpers
├── public/
├── apps_script/                    Google Apps Script (reference, runs in GAS)
│                                   syncs GCal + Calendly into a Sheet
├── dashboard/                      Legacy static dashboard (vanilla JS).
│                                   Maintained separately by a teammate; will be
│                                   ported into the Next app under a future
│                                   /dashboards/webinar route.
└── docs/DEPLOY.md                  Vercel + BigQuery setup
```

## Local dev

```bash
pnpm install
cp .env.local.example .env.local   # then fill in BQ creds
pnpm dev                            # http://localhost:3000
```

The calendar route at `/apps/calendar` queries BigQuery on every request. You
need a service-account key with read access to the `nmm_calendar` dataset (see
`docs/DEPLOY.md` for how to get one).

Without `.env.local`, the calendar route falls back to Application Default
Credentials (`gcloud auth application-default login`). The home page and other
non-BQ routes work without any credentials.

## Where data comes from

| Source            | Pipeline                                                                                  | Dataset                                  |
| ----------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| Google Calendar   | `apps_script/` → Sheet → loader (separate repo) → BQ                                      | `no-more-mondays-analytics.nmm_calendar` |
| Calendly          | Same pipeline as above                                                                    | `no-more-mondays-analytics.nmm_calendar` |
| Webinar analytics | dbt project (`no-more-mondays-analytics` repo) over Meta / GHL / Zoom / Airtable / Closer | `no-more-mondays-analytics.dbt_tuddin`   |

Key BQ views read by the calendar:

- `team_members` — 9 closers who shared their GCal with ops@
- `busy_intervals` — every event from those 9, with `is_calendly_booking` flag
- `calendar_timezones` — each closer's preferred TZ

## Deploy

See [`docs/DEPLOY.md`](./docs/DEPLOY.md). Short version:

1. Push to `main`. Vercel auto-deploys preview/production.
2. Set three env vars in Vercel: `BQ_PROJECT`, `BQ_DATASET`,
   `GOOGLE_APPLICATION_CREDENTIALS_JSON` (full SA JSON pasted as a single line).
3. Turn on Vercel Authentication under Settings → Deployment Protection
   so only logged-in teammates can view.
