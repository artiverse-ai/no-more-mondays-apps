**Audience:** Ops

A new closer is useless to the booking system until two things are true: their calendar is visible to `ops@nomoremondays.io`, and their email is on the active-closers list. This SOP walks through both, in order, with the verification step you should never skip.

## 01 — Send the new closer the calendar SOP

> **Why:** They have to do the share step themselves (Google requires the calendar owner to grant access). Don't re-explain — link them to the canonical instructions.

1. Send them the Calendar management for closers SOP.
2. Highlight section **01 — Share your calendar with ops@nomoremondays.io**. That's the only one they need to act on right away.
3. Sections 02–08 are their ongoing hygiene playbook — they can read those at their own pace, but the share has to happen before they take their first booking.

## 02 — Confirm the share landed

> **Why:** Closers sometimes share with permission *See only free/busy (hide details)* by mistake, which our loader rejects. Better to catch it now than the first time a booking gets offered into their lunch.

1. Sign into Google Calendar as `ops@nomoremondays.io` (or ask whoever owns that mailbox).
2. Their primary calendar should appear under **Other calendars** in the left sidebar.
3. Hover their calendar → ⋮ → **Settings**. Permission should read **Make changes and manage sharing** OR **See all event details**. Anything more restrictive is wrong — ask them to redo step 1 of the closer SOP with the right permission.

## 03 — Add them to the active-closers list

> **Why:** Sharing the calendar alone isn't enough. The dashboard reads a separate active-closers list to decide whose calendar to surface. A closer not on the list will never appear in the capacity view, even if their calendar is shared.

1. Open the **Closers tab on the admin page** (`/admin/closers` — the *Admin* link is top-right of the calendar dashboard, or on the home page header for admins).
2. In the **Add closer by email** box, type their Google Workspace email and press **Add**. The roster updates instantly.
3. New closers come in with both toggles **on**:
   - **Active** — they exist in the system. Off-roster otherwise.
   - **Available** — they can take calls. Use this for short-term pauses (vacation, training, ramp-up).
4. They appear in the booking dashboard on the next 5-minute sync. Check the **In dashboard** counter on the same page — it should tick up by 1.
5. If they aren't ready to take calls yet, flip **Available** off. Their row stays on the roster but they don't get offered for bookings until you flip it back.

## 04 — Verify they show up in the dashboard

> **Why:** The end-to-end check. If they don't appear here, the booking system can't see them — fix the pipeline before you mark them "onboarded".

1. Wait **5–10 minutes** for the next sync run to pick up the new row in the active-closers list (and the calendar share, if it's the first sync since they shared).
2. Open the capacity dashboard (`/apps/calendar`).
3. Their short-name pill should appear in the **Filter by closer** row. If it doesn't — calendar share didn't land or active-list change wasn't saved. Recheck steps 02 and 03.
4. Click their name to filter to just them. The matrix should show their busy times (sleep, recurring meetings, etc.) — empty cells are when they'd be offered for booking.
5. If the matrix is completely empty: their calendar has zero events in the visible window. Either no recurring blockers set up yet (a problem — they need to do steps 02–05 of the closer SOP), or the calendar share permission is wrong (recheck step 02 above).

## 05 — Train them on calendar hygiene

> **Why:** The closer SOP is exhaustive. New closers often skim it. A 10-minute sync with them — going through the dashboard on their own data — saves a month of double-booking complaints.

1. On the call, share the capacity dashboard with their name filtered.
2. Walk them through what every empty cell means: a real prospect could be offered that slot in 5 minutes. Does that match reality?
3. Pick one obvious miss (e.g. they don't have a sleep block) and have them add it live on the call. Show them the dashboard refresh.
4. Bookmark the closer SOP for them. Encourage the 3-minute weekly check from section 08 of that doc.

---

*Any step unclear or broken — email ops@nomoremondays.io.*
