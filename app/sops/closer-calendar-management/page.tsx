import { PrintButton } from "../PrintButton";

export const metadata = {
  title: "Calendar management for closers · NMM SOPs",
};

export default function CloserCalendarManagementSop() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Closer Onboarding</p>
        <h1 className="sop-h1">Calendar management — your responsibility</h1>
        <p className="sop-lead">
          Your Google Calendar is the source of truth for when prospects can
          book you. If a slot is empty in your calendar, the booking system
          will offer you for that slot — no exceptions. Five minutes of setup,
          three minutes a week, and we never double-book you. Read this once,
          then keep it as a reference.
        </p>
        <div className="sop-toolbar">
          <PrintButton />
          <a
            className="sop-btn"
            href="mailto:ops@nomoremondays.io?subject=Calendar%20setup%20question"
          >
            Question? Email ops
          </a>
        </div>
      </header>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">01</span>
          <h2 className="sop-h2">Share your calendar with ops@nomoremondays.io</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Without this, the booking system cannot read
          your calendar and will not know when you are busy. This step is
          non-negotiable.
        </p>
        <ol>
          <li>
            Open Google Calendar in a browser. The mobile app does <em>not</em>{" "}
            have this setting.
          </li>
          <li>
            In the left sidebar under <strong>My calendars</strong>, hover your
            primary calendar (usually your name) and click the <kbd>⋮</kbd> menu
            → <strong>Settings and sharing</strong>.
          </li>
          <li>
            Scroll to <strong>Share with specific people or groups</strong> →{" "}
            <strong>Add people</strong>.
          </li>
          <li>
            Email: <code>ops@nomoremondays.io</code>
          </li>
          <li>
            Permission: <strong>See all event details</strong> — not just
            free/busy. We need event titles to distinguish meetings from
            personal time.
          </li>
          <li>Save. Takes effect immediately.</li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">02</span>
          <h2 className="sop-h2">Block 100% of your unavailable time</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> The system only knows what is on your calendar.
          If a time is empty in your calendar, it is offered for booking. The
          system cannot guess what you &ldquo;usually&rdquo; do.
        </p>
        <p>
          Put <em>everything</em> that makes you unavailable on your calendar —
          including things you have always relied on memory for:
        </p>
        <ul className="sop-grid-2">
          <li>Sleep window (recurring, e.g. 10pm – 7am)</li>
          <li>Gym, school runs, kids&rsquo; activities</li>
          <li>Lunch / dinner breaks</li>
          <li>Doctor / dentist / appointments</li>
          <li>Family / personal commitments</li>
          <li>Other client meetings</li>
          <li>Travel / commute time</li>
          <li>Vacation &amp; OOO (multi-day all-day events)</li>
        </ul>
        <p className="sop-callout">
          <strong>Rule of thumb:</strong> if you would not pick up a call during
          that time, it must be on your calendar.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">03</span>
          <h2 className="sop-h2">
            Mark personal blockers as &ldquo;Busy&rdquo;, not &ldquo;Free&rdquo;
          </h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Each Google Calendar event has a{" "}
          <em>Show me as</em> setting. Events marked <strong>Free</strong> are
          ignored by our system, so you would still be offered for booking even
          though you are at the gym.
        </p>
        <ol>
          <li>Open the event in Google Calendar.</li>
          <li>Click <strong>More options</strong> (or the pencil/edit icon).</li>
          <li>
            Find <strong>Default visibility</strong> — next to it is{" "}
            <strong>Show me as</strong>.
          </li>
          <li>
            Set to <strong>Busy</strong>.
          </li>
        </ol>
        <p>
          When in doubt, default to <strong>Busy</strong>. Only use{" "}
          <strong>Free</strong> for things that should explicitly NOT block
          bookings (e.g. an FYI placeholder).
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">04</span>
          <h2 className="sop-h2">Set your calendar timezone correctly</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Recurring events are stored in the
          calendar&rsquo;s timezone. The wrong TZ means events drift across the
          year as DST changes, and your &ldquo;9am block&rdquo; suddenly
          becomes 8am or 10am.
        </p>
        <ol>
          <li>
            Google Calendar → <strong>Settings</strong> → <strong>General</strong>{" "}
            → <strong>Time zone</strong>.
          </li>
          <li>
            Set <strong>Primary time zone</strong> to your actual home timezone
            — e.g. <code>America/New_York</code> for Eastern,{" "}
            <code>America/Phoenix</code> for Arizona,{" "}
            <code>America/Chicago</code> for Central.
          </li>
          <li>
            Travelling? Don&rsquo;t change your primary TZ. Google handles DST.
            Only update if you permanently relocate.
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">05</span>
          <h2 className="sop-h2">Recurring blockers beat one-off ones</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> If your routine is the same every day, set a
          recurring event once. Way less effort to maintain than blocking each
          day individually — and you won&rsquo;t forget.
        </p>
        <p>Examples worth making recurring:</p>
        <ul>
          <li>
            <strong>Sleep:</strong> 10:00 PM → 7:00 AM, daily, marked Busy
          </li>
          <li>
            <strong>Lunch:</strong> 12:00 PM → 1:00 PM, weekdays, marked Busy
          </li>
          <li>
            <strong>End-of-day cutoff:</strong> 6:00 PM → 8:00 PM, weekdays,
            marked Busy — if you don&rsquo;t take evening calls
          </li>
          <li>
            <strong>Gym / fitness:</strong> whatever your real schedule is
          </li>
          <li>
            <strong>Sales huddle / NSC / SheSells</strong> — should already be
            on your calendar via the shared event invite
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">06</span>
          <h2 className="sop-h2">When plans change, update the event</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> If you delete a calendar event after the fact
          (e.g. a meeting that ran long got cut), the booking system happily
          offers that slot again to a prospect.
        </p>
        <ul>
          <li>
            <strong>Cancelling one instance of a recurring event:</strong>{" "}
            choose <em>This event</em>, not <em>This and following</em>, unless
            the change is permanent.
          </li>
          <li>
            <strong>Running over?</strong> Drag the event to extend it.
            Don&rsquo;t leave a 30-minute call ballooning to 90 minutes
            silently.
          </li>
          <li>
            <strong>Going OOO mid-week?</strong> Add a multi-day all-day OOO
            event. Mark it Busy.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">07</span>
          <h2 className="sop-h2">Sync timing — expectations</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> So you know how fast your changes take effect.
        </p>
        <ul>
          <li>
            The booking system refreshes every <strong>5 minutes</strong>.
          </li>
          <li>
            New events / edits show up within that window. If something is
            still wrong after 10 minutes, ping ops.
          </li>
          <li>
            Don&rsquo;t rely on the system for sub-5-minute decisions — use
            your live calendar for those.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">08</span>
          <h2 className="sop-h2">Quick weekly self-check (3 min)</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Calendar hygiene compounds. Three minutes on
          Monday morning beats a missed call on Wednesday.
        </p>
        <ol>
          <li>Open your week view in Google Calendar.</li>
          <li>
            Look for <strong>empty patches</strong> when you know you&rsquo;ll
            be unavailable. Block them.
          </li>
          <li>
            Verify recurring blockers (sleep, lunch, gym) are still active for
            the week.
          </li>
          <li>
            If you&rsquo;re going to be OOO any day this week, add the OOO
            event now — not the morning of.
          </li>
        </ol>
      </section>

      <footer className="sop-footer">
        Questions or something not working — email{" "}
        <a className="sop-link" href="mailto:ops@nomoremondays.io">
          ops@nomoremondays.io
        </a>{" "}
        or post in #sales-ops on Slack.
      </footer>
    </main>
  );
}
