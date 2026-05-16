**Audience:** Sales managers · Setters

Same calls table as the Sales dashboard, rolled up by setter instead of closer. Built to answer "which setter is booking the right calls" — not just volume, but show rate and downstream cash.

## 01 — What it answers

- Which setter booked the most calls? The most calls that *showed*?
- Whose Setter DQ rate is creeping up — an early signal of lead-quality drift?
- Cash per booking by setter — volume vs. quality trade-off.
- Bonus eligibility check (combined SR ≥ 80% AND combined Pros (SQ) ≥ 20).

## 02 — Hero metrics — setter view

- **Setter DQ Rate** — Setter DQ / Pros (D'd). Bake a baseline first — team average is the right comparison, not absolute thresholds.
- **Show Rate** — Shows / Pros (SQ). Reflects setter quality + reminder discipline.
- **Cash per Booking** — Cash from deals attributed to this setter / total Prospects they sourced. Volume-aware quality score.

## 03 — Cross-filters

Identical filter set to the **Sales dashboard** — Source, Closer, Setter, Triage, Call Outcome, OCC·FUC, email search. Cross-filters compose; chip lists are derived from unfiltered data.

## 04 — The per-setter rollup

- One row per setter. Volume (Pros, Pros-SQ, Shows), quality (Setter DQ Rate, Show Rate), downstream (Deals, Cash).
- Sort by Bookings by default. Click any header to re-sort.
- **Detail view** (tab toggle) flattens to one row per call — the audit trail when an aggregate looks suspect.

## 05 — When numbers look wrong

- **Setter has Bookings but 0 Shows:** the cycle is mid-flight (calls haven't happened yet). Filter to a closed week.
- **Setter shows up twice:** `setter_owner` normalization escape. Ping data ops.
- **Cash attribution looks off:** cash is attributed by `is_deal` + `cash_collected` on the call row, not on the booking. A setter doesn't "earn" the cash unless their booking became a deal. Use Dev Mode to verify.

## 06 — Related SOPs

- **Sales (Closer) Performance dashboard**
- **Weekly Report dashboard** — Setter Performance section in Tab 3 (Monday only).

---

*Spot a bug or have a feature ask? Open a PR or issue on no-more-mondays-apps.*
