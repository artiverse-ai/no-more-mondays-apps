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
│   ├── apps/
│   │   ├── calendar/               Team-availability app (live BigQuery)
│   │   │   ├── page.tsx
│   │   │   └── team/[email]/page.tsx
│   │   └── calendly-search/        Internal-note search across Calendly events
│   │       ├── page.tsx
│   │       ├── SearchClient.tsx
│   │       ├── components/
│   │       └── lib/
│   ├── dashboards/
│   │   └── webinar/                Webinar Performance dashboard — live BigQuery
│   │       ├── page.tsx            over dbt_tuddin marts; overview + filters
│   │       └── [date]/page.tsx     per-webinar drill-through (KPIs, funnel, calls)
│   ├── admin/                      Access management (add/remove allow-listed users)
│   │   ├── page.tsx
│   │   ├── AdminClient.tsx
│   │   └── actions.ts              Server Actions that hit the Cloudflare API
│   └── api/
│       └── calendly/[...path]/     Server-side Calendly proxy (holds PAT)
├── proxy.ts                        Next 16 proxy — gates whole site behind CF Access
├── components/                     UI + chart components (shadcn-based)
│   └── webinar/                    Webinar dashboard charts, table, filters
├── lib/                            bq client, availability + closers + webinar
│   ├── cf-access.ts                Read current user from CF Access headers
│   ├── cloudflare.ts               Cloudflare Access Group REST client
│   └── webinar.ts                  BigQuery queries over dbt_tuddin webinar marts
├── public/
├── apps_script/                    Google Apps Script (reference, runs in GAS)
│                                   syncs GCal + Calendly into a Sheet
└── docs/DEPLOY.md                  Vercel + BigQuery setup
```

## Local dev

```bash
pnpm install
cp .env.local.example .env.local   # then fill in BQ creds
pnpm dev                            # http://localhost:3000
```

The BigQuery-backed routes — `/apps/calendar` (reads `nmm_calendar`) and
`/dashboards/webinar` (reads `dbt_tuddin`) — query BigQuery on every request.
You need a service-account key with read access to both datasets in
`no-more-mondays-analytics` (see `docs/DEPLOY.md` for how to get one).

Without `.env.local`, these routes fall back to Application Default Credentials
(`gcloud auth application-default login`). The home page, SOPs, and the
Calendly apps work without any BigQuery credentials.

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

## Access model

The site sits behind **Cloudflare Access** on the custom domain
`apps.nomoremondays.io`. Cloudflare gates by email; allowed emails live in a
single Cloudflare Access Group. The `/admin` route (visible only to a
hard-coded list of `ADMIN_EMAILS`) is the day-to-day control panel — adding
or removing users there calls the Cloudflare API to update the group, so the
in-app admin UI and Cloudflare stay in sync.

- `proxy.ts` redirects any request without the `Cf-Access-Authenticated-User-Email`
  header to the custom domain, forcing it through CF Access.
- Set `SKIP_AUTH=1` to bypass the gate during initial deploys before CF Access
  is wired up.

## Deploy

See [`docs/DEPLOY.md`](./docs/DEPLOY.md). Short version:

1. Push to `main`. Run `vercel deploy --prod` (latest commit's author must be
   a Vercel team member of `no-more-mondays`).
2. Set env vars in Vercel — see `.env.local.example` for the full list.
3. Visit `https://apps.nomoremondays.io/admin` (after CF Access is set up) to
   manage who can sign into the site.
