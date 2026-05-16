**Audience:** Sales ops · Marketing

Find Calendly bookings by funnel tag — then narrow by closer scope, host, or status. The fast way to trace one deal, one campaign, or one bug from booking through close.

## 01 — What it's for

- **Trace a specific call** end-to-end — from the funnel tag at booking through who held it, what the outcome was, and what the prospect answered on the form.
- **Audit a funnel/campaign** — pull every booking that carried a specific UTM/event tag.
- **QA new funnel routing** — when you ship a new ad funnel, search by the tag to confirm bookings are being attributed correctly.

## 02 — How search works

1. Type a **funnel tag** (or partial) into the search box. The dropdown shows matching tags ranked by recency.
2. Pick a tag. The result list populates with every Calendly booking carrying that tag.
3. Refine with the filters: closer scope (all / specific closer), Calendly host, status (active / canceled / rescheduled).
4. Click any row to expand — you see the prospect's answers to the booking-form questions, the host, the outcome (held / no-show / canceled / rescheduled).

## 03 — When to use this vs. another dashboard

- **One prospect or one deal** — use this. The Sales / Setter dashboards roll up to numbers; this shows the underlying call rows.
- **Volume / rate questions** ("how many Sunday-webinar bookings did we get?") — use the [SOP: Sales Performance](https://www.notion.so/nomoremondays/SOP-Sales-Performance-3629b9a6796a809f9822fecf1f09a2d9) cross-filters.
- **Webinar-level reads** — use the [SOP: Webinar Performance Dashboard](https://www.notion.so/nomoremondays/SOP-Webinar-Performance-Dashboard-3629b9a6796a8007a796fe291db98bad).

## 04 — When results look wrong

- **Expected booking doesn't appear:** check the funnel tag spelling — tags are case-insensitive but punctuation-sensitive.
- **Booking has no host:** Calendly didn't push the host name to the webhook. Open the Calendly admin and re-link the event type.
- **Form answers are missing:** the answer-capture field is null when the prospect skipped the question (most optional fields). Not a bug.

## 05 — Related SOPs

- [SOP: Sales Performance](https://www.notion.so/nomoremondays/SOP-Sales-Performance-3629b9a6796a809f9822fecf1f09a2d9) — per-closer rollup of the same Calendly data.
- [SOP: Setter Performance Dashboard](https://www.notion.so/nomoremondays/SOP-Setter-Performance-Dashboard-3629b9a6796a80fe88cff0294415a19f) — per-setter rollup of the same data.
- [SOP: How to Read the Capacity Dashboard](https://www.notion.so/nomoremondays/SOP-How-to-Read-the-Capacity-Dashboard-3629b9a6796a803e8b26eeae2fef5a34) — same Calendly source data, capacity perspective.

---

*Spot a bug or have a feature ask? Open a PR or issue on no-more-mondays-apps.*
