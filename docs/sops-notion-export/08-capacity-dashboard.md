**Audience:** Ops · Sales managers

The capacity dashboard shows you, at a glance, how much room there is on the team's calendars for new bookings over the next few days. It pulls from every active closer's Google Calendar (via `ops@nomoremondays.io`) plus Calendly bookings, merges overlaps, and answers one question: *if a prospect wants to book a 60-minute call this week, can we offer them anything?*

## 01 — What the dashboard answers

> **Why:** Before you tweak any filter, know what question you're asking.

- **How many bookable slots** exist in the date range you picked (cells where ≥ 1 closer is free).
- **How that capacity is distributed across days** — is Monday packed and Friday wide open?
- **Which closer has the most free time** — useful when assigning a hot lead.
- **Where the conflicts cluster** — fully-booked cells in the slot matrix show the squeeze points.

## 02 — The filter bar — what each control does

> **Why:** The filters change everything below them. Skim this once.

- **Date range** — defaults to the upcoming Monday through Friday in your selected timezone. Click either date to change it, or use the ‹ / › arrows to shift the whole range by the same number of days.
- **Call length** — 45 min or 60 min. Drives both the slot duration and how often slots open (45 min calls every 1 hour; 60 min calls every 1 h 30 m).
- **Show times in** — render-only timezone selector. Defaults to Eastern (ET). All underlying data is stored in UTC; only display shifts.
- **Filter by closer** — click a name to toggle. Empty selection = whole team. Use this when you want to know *"is Sam free Tuesday afternoon?"* without other closers' calendars cluttering the view.

> 💡 **Tip:** Filter changes update the URL — bookmark a specific view (e.g. "next 2 weeks, Sam + Alex only, 60 min") and share it.

## 03 — Headline KPIs at the top

> **Why:** The single-number snapshots that answer "how cooked are we?"

- **Bookable slots** — total cells where at least one closer is free.
- **Available capacity** — sum of free closers across all slots (1 closer free in 1 slot = 1 unit of capacity).
- **Avg free closers per slot** — bookable slots ÷ total slots, weighted. A drop here means the team is packed even when slots are technically open.
- **Fully booked slots** — slots where every selected closer is busy. Climbing fully-booked counts day-over-day is the early signal for a capacity squeeze.

## 04 — The two charts

> **Why:** KPIs are blunt — the charts show shape.

- **Per-day available capacity** (left): each bar is one day. Height = total free-closer-units that day. Spot patterns like "every Wednesday tanks because of NSC".
- **Per-closer split** (right): how many bookable slots each closer has across the whole range. The closer with the tallest bar should get the next manual assignment.

Both respect the current **Filter by closer** selection, so you can drill in or zoom out without leaving the page.

## 05 — The slot matrix — how to read a cell

> **Why:** This is where you find a specific opening.

- Rows are slot start times in the selected timezone. Columns are days in the range.
- Each cell shows **how many closers are free** at that slot. `0` = fully booked, higher numbers = more headroom.
- Hover or tap a cell to see *which* closers are free.
- Day totals at the top of each column = bookable slots that day (cells where ≥ 1 closer is free).

> 💡 **Quick read:** a row that's mostly zeros tells you that time-of-day is consistently booked across the team — push back at that hour or move things around. A column that's mostly zeros tells you to avoid that day for new bookings.

## 06 — Drilling into a specific closer's week

> **Why:** Sometimes the matrix isn't enough — you want to see *what* the closer is busy with.

1. Click a closer's name on any chart or in the matrix tooltip. You'll land on their week timeline.
2. The timeline shows every event from their calendar (titles included) plus Calendly bookings. Calendly bookings carry the event-type name and the invitee's answers to the booking form, where available.
3. Use the date controls to scrub forward or back. The page does NOT carry your home-page filter state — it's a focused single-closer view.

## 07 — The (i) badge next to a closer

> **Why:** The booking system trusts whatever it sees on a closer's calendar. If their calendar is thin — too few events, too little blocked time — the dashboard happily offers them for slots they actually can't take.

In the **Filter by closer** row, a closer pill turns **amber** when their calendar has too little blocked time for the visible date range, and a small `(i)` info badge appears next to the pill. Hover the `(i)` to see the exact reason.

One TZ-independent signal — the team lives in many timezones:

- **Hours blocked per day** — total busy minutes in the visible range, divided by days. Even a single nightly sleep block clears 8 hours. Below **8h/day**: something structural is missing.
- OOO events, all-day blockers, and long meetings all count as blocked time — raw event count isn't used, since some healthy calendars have one big OOO covering most of the day.

> 💡 **Action:** send them the **Calendar management for closers** SOP. If they aren't ready to fix it today, pause them via `/admin/closers` (flip *Available* off) so the dashboard stops offering them until they've set things up.

## 08 — When numbers look wrong

> **Why:** The dashboard is downstream of two systems that each have their own freshness lag. Knowing the lag tells you whether you're seeing a real problem or just stale data.

- **Google Calendar → BigQuery:** a sync job runs every **5 minutes**. Recent calendar edits typically appear within that window. If something is missing beyond ~10 minutes, ping ops.
- **A closer appears who shouldn't / is missing:** the active closer list lives in a Google Sheet (being moved into BigQuery directly). Tag the ops thread.
- **Slot matrix says a closer is free but their calendar shows an event:** check the event's "Show me as" setting — events marked *Free* are ignored by design.
- **Time-zone confusion:** the matrix renders in whatever TZ you've selected. Storage is always UTC. Toggling the TZ shifts visual labels, not the underlying calendar truth.

## 09 — Related SOPs

- **Calendar management for closers** — what every closer is supposed to be doing on their end. Read it once so you know what to ask a closer to fix when the dashboard shows something weird.
- **When a new closer joins** — the steps to add them so they appear here.
- **When a closer is removed** — how to take them off cleanly.

---

*Spot a bug in the dashboard itself or have a feature ask? Open a PR or an issue on no-more-mondays-apps.*
