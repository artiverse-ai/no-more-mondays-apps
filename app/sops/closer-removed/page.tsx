import Link from "next/link";
import { PrintButton } from "../PrintButton";

export const metadata = {
  title: "When a closer is removed · NMM SOPs",
};

export default function CloserRemovedSop() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Operations</p>
        <h1 className="sop-h1">When a closer is removed</h1>
        <p className="sop-lead">
          Removing a closer is a two-side action: stop the booking system from
          offering them <em>and</em> deal with their in-flight calls and
          history. Skip either side and you either keep offering an
          unavailable closer or you lose attribution on their existing deals.
        </p>
        <div className="sop-toolbar">
          <PrintButton />
          <a
            className="sop-btn"
            href="mailto:ops@nomoremondays.io?subject=Closer%20offboarding"
          >
            Question? Email ops
          </a>
        </div>
      </header>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">01</span>
          <h2 className="sop-h2">Mark them inactive on the active-closers list</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> This is the kill-switch. As soon as the next
          sync runs, the booking system stops offering them. Don&rsquo;t
          delete the row — flip the flag — so historical reporting still
          knows who they were.
        </p>
        <p>
          <strong>Today (Google Sheet):</strong>
        </p>
        <ol>
          <li>
            Open the <em>Active Closers</em> Google Sheet.
          </li>
          <li>
            Find their row. Set <strong>is_active</strong> = <code>FALSE</code>{" "}
            and fill in <strong>end_date</strong> with today.
          </li>
          <li>
            Save. <em>Do not delete the row</em> — past bookings and any
            historical reporting still reference their email.
          </li>
        </ol>
        <p className="sop-callout">
          <strong>Coming soon:</strong> the active-closers list moves to
          BigQuery with an admin UI in this app. The button to deactivate
          will live there.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">02</span>
          <h2 className="sop-h2">Verify they&rsquo;ve dropped from the dashboard</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Confirms the kill-switch worked end-to-end.
        </p>
        <ol>
          <li>
            Wait <strong>5–10 minutes</strong> for the next sync run.
          </li>
          <li>
            Open the{" "}
            <Link className="sop-link" href="/apps/calendar">
              capacity dashboard
            </Link>
            .
          </li>
          <li>
            Their name should no longer appear in the{" "}
            <strong>Filter by closer</strong> row, and the slot matrix should
            have one fewer column of contributors.
          </li>
          <li>
            If they&rsquo;re still there after ~15 minutes, recheck step 01 —
            the row probably didn&rsquo;t save, or you flipped the flag on the
            wrong row.
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">03</span>
          <h2 className="sop-h2">Handle their in-flight Calendly bookings</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> The active-list flip stops <em>future</em>{" "}
          bookings, not ones already on their Calendly. A prospect with a
          confirmed call on their calendar will still expect a human to show
          up.
        </p>
        <ol>
          <li>
            Pull their upcoming bookings from{" "}
            <Link className="sop-link" href="/apps/calendly-search">
              /apps/calendly-search
            </Link>
            : search their name or email in the &ldquo;Filter by host&rdquo;
            chips with date range &ldquo;Next 14 Days&rdquo;.
          </li>
          <li>
            For each upcoming call, decide: reassign to another closer
            (preferred) or cancel with a personal note to the prospect
            (last resort).
          </li>
          <li>
            If reassigning: edit the Calendly event to a new host, or rebook
            the prospect via DM. Update the new closer in #sales-ops so they
            know to expect it.
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">04</span>
          <h2 className="sop-h2">Revoke their Calendly seat (if applicable)</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> If they keep an active Calendly host seat,
          their event types stay live and may still accept bookings via direct
          link or shared booking pages, even after they&rsquo;re off the
          active list.
        </p>
        <ol>
          <li>
            In Calendly admin: <strong>Account &rarr; Members</strong> &rarr;
            find them &rarr; <strong>Remove</strong>.
          </li>
          <li>
            Calendly will ask whether to redirect their event types. Choose
            <em> Delete</em> unless ops needs to preserve historical event-type
            URLs.
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">05</span>
          <h2 className="sop-h2">Leave the calendar share alone</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Counterintuitive — the calendar share with{" "}
          <code>ops@</code> is harmless once the closer is inactive in the
          system. Removing it forces a re-share dance if they ever come back,
          and breaks historical drill-through on past bookings.
        </p>
        <ul>
          <li>
            <strong>Keep the share</strong>. The capacity dashboard already
            ignores their calendar because they&rsquo;re inactive in step 01.
          </li>
          <li>
            <strong>Exception:</strong> if the closer is leaving the company
            entirely and their Google account will be deactivated, the share
            disappears automatically when Google revokes their workspace
            access. Nothing to do.
          </li>
          <li>
            <strong>Privacy escalation:</strong> if the closer asks for their
            calendar to be disconnected, comply — they can revoke from their
            side via Calendar Settings → Sharing.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">06</span>
          <h2 className="sop-h2">Update Slack and ops docs</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> So the rest of the team knows. Closers move on;
          surprise is the only thing to avoid.
        </p>
        <ol>
          <li>
            Post in #sales-ops: name, last day, who&rsquo;s catching their
            follow-ups. Tag the manager.
          </li>
          <li>
            If there are open opportunities in their pipeline, reassign in
            Airtable (or wherever the CRM lives today).
          </li>
          <li>
            Remove from any internal Slack groups, Notion docs, etc. that key
            on their email.
          </li>
        </ol>
      </section>

      <footer className="sop-footer">
        Edge cases or unclear steps — email{" "}
        <a className="sop-link" href="mailto:ops@nomoremondays.io">
          ops@nomoremondays.io
        </a>
        .
      </footer>
    </main>
  );
}
