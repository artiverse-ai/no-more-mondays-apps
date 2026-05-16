**Audience:** Marketing · CEO

Per-webinar breakdown of every Sunday and Wednesday event since launch. Spend → Registrations → Attendance → Bookings → Shows → Deals → Cash, with cost-efficiency derivations alongside. Pulls from `dbt_tuddin.mart_webinar_events`.

## 01 — What it answers

- Which webinars drove the most cash per dollar spent?
- How are Sunday vs Wednesday webinars trending?
- Where did the funnel break this week — reg, attend, book, show, or close?
- Which era of webinar (pre/post format change) performed best?

## 02 — Filters

- **Day** — Sunday / Wednesday. Empty = both.
- **Era** — `data_era` tag from the mart (e.g. pre/post a format change). Used to compare apples-to-apples.
- **From / To** — date range. Defaults to all-time.
- **View** — Overview (KPI cards + chart) or Detail (per-webinar table).
- **Granularity** — chart x-axis: per webinar / day / week / month / year. Per-webinar gives the most detail; week is the right roll-up for trend reading.
- **Sort + dir** — in Detail view, sort by any column.

## 03 — Drilling into one webinar

> **Why:** The list-level numbers tell you which event was the outlier; the per-event page tells you why.

1. From the Detail view, click a webinar date. You land on `/dashboards/webinar/[date]`.
2. That page exposes everything the weekly report Tab 2 also shows: registrations by channel, Meta funnel (Impressions → Link Clicks → Conversions), cost-per-this and cost-per-that, the reactivation funnel, and Cash + ROAS.
3. Dev Mode (admin) reveals the SQL behind every cell.

## 04 — Dev Mode

Same shared cookie as the other dashboards. Toggling Dev Mode here also flips it on the Sales / Setter / Weekly Report / High-Level dashboards.

## 05 — When numbers look wrong

- **Latest webinar row is partial:** the cycle is in-flight. Shows / Deals / Cash will fill in over the next 48–72h.
- **Cost / Attendee jumps without an ad spend change:** Zoom attendee count is best-session deduped. A small Zoom change can swing the denominator. Compare to the GHL registrants attend rate for sanity.
- **Reactivation columns are 0 but you ran a push:** the reactivation flag in the mart needs to be wired for the specific cycle — check the `is_reactivation_data_available` column.

## 06 — Related SOPs

- **Weekly Report dashboard** — Tab 2 is the snapshotted version of this dashboard for the last 3 webinars.
- **High-Level (CEO) dashboard** — the daily rollup that aggregates these webinar cycles.

---

*Spot a bug or have a feature ask? Open a PR or issue on no-more-mondays-apps.*
