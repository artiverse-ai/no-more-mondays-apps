**Audience:** Sales ops · Marketing · CEO

Sibling app to Funnel Search. Same UI, same charts, same tables — but filtered by **when bookings were created** instead of when the call is scheduled. Answers "who's booking right now?" instead of "who's showing up on Friday?".

## 01 — What it's for

> **Why:** Booking-pace insight. Tells you whether the funnel is heating up or cooling off in real time, separate from the calls that are already on the calendar.

- **Pulse check on a campaign**: spike in bookings yesterday → which ad/funnel drove it?
- **Booking-rush hours**: the heatmap shows day × hour of when people *book* (not when calls are held). Surfaces "every Tuesday at 2pm ET we get a flood of bookings".
- **Recent activity audit**: list every booking made in the last 7 / 30 / 90 days regardless of when the call itself is scheduled.
- **Cancellation pattern**: see active vs canceled created in the same window.

## 02 — Default behaviour

- **Default date range: last 7 days** (bookings created in the previous 7 days, including today).
- **No future presets**: a booking can't be created in the future, so the picker only offers past windows.
- Preset options: Today / Last 24h / Last 2 Days / Last 7 Days / Last 30 Days / Last 90 Days / Custom Range.

## 03 — Filter chips (same as Funnel Search)

1. **Funnel tag** (internal_note on the Calendly event type) — primary filter. Pick one or many.
2. **Title prefix** — narrows by event-type name on top of the funnel tag.
3. **Host** — Calendly host (the setter/closer who owns the event type).
4. **Status** — active / canceled.
5. **Closer scope** — All / Active only / Inactive only / Specific closer (pulled from the active-closers admin list).

All chips compose. Empty = no filter.

## 04 — Reading the dashboard

> **Why:** Same charts as Funnel Search but the date axis means something different — read carefully.

- **Metrics strip** — Matched Calls = bookings created in window; Unique Prospects = distinct invitee emails; Active / Canceled counts; double-booked prospects; canceled-only prospects. The "Earliest / Latest" date band shows the *scheduled* call span (so you know what time-range your booked calls cover).
- **Daily Volume chart** — bookings created per day, stacked active/canceled. Spot booking-pace shifts.
- **Call Heat Matrix** — day × hour bucket of when bookings were created (Eastern Time). Hover a cell to see the actual calls inside, sorted by scheduled call time.
- **Funnel Distribution** — share of bookings per internal_note across the window.
- **Host Distribution** — share of bookings per host across the window.
- **Bookings table** — one row per booking with both `created_at` and `start_time` visible. Click any row → JSON modal with raw Calendly payload.
- **Invitees / Hosts tables** — rollups by invitee and host.

## 05 — How the data is fetched

> **Why:** Calendly's API doesn't natively let you filter by created_at — knowing the workaround helps when something looks off.

1. Calendly's `/scheduled_events` endpoint only accepts `min_start_time` / `max_start_time` (call-time) as a server-side filter. There is NO `min_created_time`.
2. The app fetches a **wide start_time window** = (your creation window start − 60 days) through (today + 2 years).
3. It chunks that into 60-day pieces, fans out per status (active + canceled), and reassembles.
4. Locally it then **drops every event whose `created_at` is outside your chosen creation window**.
5. Result: 100% accurate creation-time filtering, with the cost of fetching more events than strictly needed.

**Edge case**: a booking created today for a call scheduled more than 2 years out would be missed by the default fetch horizon. If your business does this, ask ops to widen the horizon. For NMM today this never happens.

## 06 — When it differs from Funnel Search

| Question | Funnel Search | Call Creation Stats |
|---|---|---|
| "Who's showing up on Friday?" | ✅ Filter by Friday | ❌ Wrong tool |
| "How many bookings did we get yesterday?" | ❌ Misses calls scheduled for later | ✅ Filter by yesterday |
| "What were our top funnels last week?" (booking volume) | ❌ Distorted — only counts calls happening last week | ✅ Counts bookings made last week |
| "Who has free time tomorrow?" | ✅ Filter scheduled = tomorrow | ❌ Use the [SOP: How to Read the Capacity Dashboard](https://www.notion.so/nomoremondays/SOP-How-to-Read-the-Capacity-Dashboard-3629b9a6796a803e8b26eeae2fef5a34) instead |

## 07 — When results look wrong

- **Booking missing from the table:** check the funnel tag — case-insensitive but punctuation-sensitive. Try removing the host/status filters.
- **"Why is created_at = yesterday but start_time = 9 months ago?"** — Calendly returns `created_at` as the original booking timestamp. Even if someone rescheduled to a past date, `created_at` doesn't change. This is correct.
- **Fewer rows than expected:** the fetch horizon is today + 2 years. Bookings made for calls > 2 years out are dropped. Verify with Calendly directly if you suspect this.
- **Search is slow:** widen the start_time window = more chunks = more API calls. A "Last 30 days created" search fetches ~13 chunks per status. A "Last 90 days" search fetches more. Acceptable.

## 08 — Related SOPs

- [SOP: Funnel Search](https://www.notion.so/nomoremondays/SOP-Funnel-Search-3629b9a6796a8009819ad89561108f89) — the call-time variant. Same UI, opposite date dimension.
- [SOP: How to Read the Capacity Dashboard](https://www.notion.so/nomoremondays/SOP-How-to-Read-the-Capacity-Dashboard-3629b9a6796a803e8b26eeae2fef5a34) — team-availability view of the same Calendly data.
- [SOP: Sales Performance](https://www.notion.so/nomoremondays/SOP-Sales-Performance-3629b9a6796a809f9822fecf1f09a2d9) — for downstream call outcomes (held / closed / cash).

---

*Spot a bug or have a feature ask? Open a PR or issue on no-more-mondays-apps.*
