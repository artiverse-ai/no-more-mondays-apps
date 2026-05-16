**Audience:** Ops

Removing a closer is a two-side action: stop the booking system from offering them *and* deal with their in-flight calls and history. Skip either side and you either keep offering an unavailable closer or you lose attribution on their existing deals.

## 01 — Mark them inactive on the active-closers list

> **Why:** This is the kill-switch. As soon as the next sync runs, the booking system stops offering them. Don't delete the row — flip the flag — so historical reporting still knows who they were.

1. Open the **Closers tab** on the admin page (`/admin/closers`) and find their row.
2. Flip **Active** off (the green pill turns grey). They drop out of the dashboard on the next sync.
3. **Don't click Remove.** Removing wipes the row and breaks historical attribution on any past bookings. *Active = off* is the soft-delete you want. The **Remove** button is for cleaning up typos and never-onboarded entries only.
4. The row moves out of **In dashboard** and into **Off-roster** in the counters at the top of the page.

## 02 — Verify they've dropped from the dashboard

> **Why:** Confirms the kill-switch worked end-to-end.

1. Wait **5–10 minutes** for the next sync run.
2. Open the capacity dashboard (`/apps/calendar`).
3. Their name should no longer appear in the **Filter by closer** row, and the slot matrix should have one fewer column of contributors.
4. If they're still there after ~15 minutes, recheck step 01 — the row probably didn't save, or you flipped the flag on the wrong row.

## 03 — Handle their in-flight Calendly bookings

> **Why:** The active-list flip stops *future* bookings, not ones already on their Calendly. A prospect with a confirmed call on their calendar will still expect a human to show up.

1. Pull their upcoming bookings from `/apps/calendly-search`: search their name or email in the "Filter by host" chips with date range "Next 14 Days".
2. For each upcoming call, decide: reassign to another closer (preferred) or cancel with a personal note to the prospect (last resort).
3. If reassigning: edit the Calendly event to a new host, or rebook the prospect via DM. Update the new closer in #sales-ops so they know to expect it.

## 04 — Revoke their Calendly seat (if applicable)

> **Why:** If they keep an active Calendly host seat, their event types stay live and may still accept bookings via direct link or shared booking pages, even after they're off the active list.

1. In Calendly admin: **Account → Members** → find them → **Remove**.
2. Calendly will ask whether to redirect their event types. Choose *Delete* unless ops needs to preserve historical event-type URLs.

## 05 — Leave the calendar share alone

> **Why:** Counterintuitive — the calendar share with `ops@` is harmless once the closer is inactive in the system. Removing it forces a re-share dance if they ever come back, and breaks historical drill-through on past bookings.

- **Keep the share.** The capacity dashboard already ignores their calendar because they're inactive in step 01.
- **Exception:** if the closer is leaving the company entirely and their Google account will be deactivated, the share disappears automatically when Google revokes their workspace access. Nothing to do.
- **Privacy escalation:** if the closer asks for their calendar to be disconnected, comply — they can revoke from their side via Calendar Settings → Sharing.

## 06 — Update Slack and ops docs

> **Why:** So the rest of the team knows. Closers move on; surprise is the only thing to avoid.

1. Post in #sales-ops: name, last day, who's catching their follow-ups. Tag the manager.
2. If there are open opportunities in their pipeline, reassign in Airtable (or wherever the CRM lives today).
3. Remove from any internal Slack groups, Notion docs, etc. that key on their email.

---

*Edge cases or unclear steps — email ops@nomoremondays.io.*
