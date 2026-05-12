import Link from "next/link";
import { PrintButton } from "../PrintButton";

export const metadata = {
  title: "When a new closer joins · NMM SOPs",
};

export default function NewCloserJoinsSop() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Operations</p>
        <h1 className="sop-h1">When a new closer joins</h1>
        <p className="sop-lead">
          A new closer is useless to the booking system until two things are
          true: their calendar is visible to <code>ops@nomoremondays.io</code>,
          and their email is on the active-closers list. This SOP walks
          through both, in order, with the verification step you should never
          skip.
        </p>
        <div className="sop-toolbar">
          <PrintButton />
          <a
            className="sop-btn"
            href="mailto:ops@nomoremondays.io?subject=New%20closer%20onboarding"
          >
            Question? Email ops
          </a>
        </div>
      </header>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">01</span>
          <h2 className="sop-h2">Send the new closer the calendar SOP</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> They have to do the share step themselves
          (Google requires the calendar owner to grant access). Don&rsquo;t
          re-explain — link them to the canonical instructions.
        </p>
        <ol>
          <li>
            Send them this link:{" "}
            <Link className="sop-link" href="/sops/closer-calendar-management">
              /sops/closer-calendar-management
            </Link>
          </li>
          <li>
            Highlight section <strong>01 — Share your calendar with
            ops@nomoremondays.io</strong>. That&rsquo;s the only one they need
            to act on right away.
          </li>
          <li>
            Sections 02–08 are their ongoing hygiene playbook — they can read
            those at their own pace, but the share has to happen before they
            take their first booking.
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">02</span>
          <h2 className="sop-h2">Confirm the share landed</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Closers sometimes share with permission{" "}
          <em>See only free/busy (hide details)</em> by mistake, which our
          loader rejects. Better to catch it now than the first time a booking
          gets offered into their lunch.
        </p>
        <ol>
          <li>
            Sign into Google Calendar as <code>ops@nomoremondays.io</code> (or
            ask whoever owns that mailbox).
          </li>
          <li>
            Their primary calendar should appear under <strong>Other
            calendars</strong> in the left sidebar.
          </li>
          <li>
            Hover their calendar → ⋮ → <strong>Settings</strong>. Permission
            should read <strong>Make changes and manage sharing</strong> OR{" "}
            <strong>See all event details</strong>. Anything more restrictive
            is wrong — ask them to redo step 1 of the closer SOP with the
            right permission.
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">03</span>
          <h2 className="sop-h2">Add them to the active-closers list</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Sharing the calendar alone isn&rsquo;t enough.
          The dashboard reads a separate active-closers list to decide whose
          calendar to surface. A closer not on the list will never appear in
          the capacity view, even if their calendar is shared.
        </p>
        <p>
          <strong>Today (Google Sheet):</strong>
        </p>
        <ol>
          <li>
            Open the{" "}
            <em>Active Closers</em> Google Sheet (linked in #sales-ops
            pinned messages).
          </li>
          <li>
            Add a new row with: <strong>email</strong> (Google Workspace
            address that owns the calendar),{" "}
            <strong>display name</strong>,{" "}
            <strong>start_date</strong> (today), and{" "}
            <strong>is_active</strong> = <code>TRUE</code>.
          </li>
          <li>Save. No need to sort — the loader handles ordering.</li>
        </ol>
        <p className="sop-callout">
          <strong>Coming soon:</strong> this list is moving directly into
          BigQuery, with an admin UI in this app. Once that lands, the
          Google Sheet step is replaced by an &ldquo;Add closer&rdquo; button
          and you can ignore everything in this section.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">04</span>
          <h2 className="sop-h2">Verify they show up in the dashboard</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> The end-to-end check. If they don&rsquo;t
          appear here, the booking system can&rsquo;t see them — fix the
          pipeline before you mark them &ldquo;onboarded&rdquo;.
        </p>
        <ol>
          <li>
            Wait <strong>5–10 minutes</strong> for the next sync run to pick
            up the new row in the active-closers list (and the calendar share,
            if it&rsquo;s the first sync since they shared).
          </li>
          <li>
            Open the{" "}
            <Link className="sop-link" href="/apps/calendar">
              capacity dashboard
            </Link>
            .
          </li>
          <li>
            Their short-name pill should appear in the <strong>Filter by
            closer</strong> row. If it doesn&rsquo;t — calendar share didn&rsquo;t
            land or active-list change wasn&rsquo;t saved. Recheck steps 02
            and 03.
          </li>
          <li>
            Click their name to filter to just them. The matrix should show
            their busy times (sleep, recurring meetings, etc.) — empty cells
            are when they&rsquo;d be offered for booking.
          </li>
          <li>
            If the matrix is completely empty: their calendar has zero events
            in the visible window. Either no recurring blockers set up yet (a
            problem — they need to do steps 02–05 of the{" "}
            <Link className="sop-link" href="/sops/closer-calendar-management">
              closer SOP
            </Link>
            ), or the calendar share permission is wrong (recheck step 02
            above).
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">05</span>
          <h2 className="sop-h2">Train them on calendar hygiene</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> The closer SOP is exhaustive. New closers
          often skim it. A 10-minute sync with them — going through the dashboard
          on their own data — saves a month of double-booking complaints.
        </p>
        <ol>
          <li>
            On the call, share the{" "}
            <Link className="sop-link" href="/apps/calendar">
              capacity dashboard
            </Link>{" "}
            with their name filtered.
          </li>
          <li>
            Walk them through what every empty cell means: a real prospect
            could be offered that slot in 5 minutes. Does that match reality?
          </li>
          <li>
            Pick one obvious miss (e.g. they don&rsquo;t have a sleep
            block) and have them add it live on the call. Show them the
            dashboard refresh.
          </li>
          <li>
            Bookmark the{" "}
            <Link className="sop-link" href="/sops/closer-calendar-management">
              closer SOP
            </Link>{" "}
            for them. Encourage the 3-minute weekly check from section 08 of
            that doc.
          </li>
        </ol>
      </section>

      <footer className="sop-footer">
        Any step unclear or broken — email{" "}
        <a className="sop-link" href="mailto:ops@nomoremondays.io">
          ops@nomoremondays.io
        </a>
        .
      </footer>
    </main>
  );
}
