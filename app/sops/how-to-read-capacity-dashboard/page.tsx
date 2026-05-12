import Link from "next/link";
import { PrintButton } from "../PrintButton";

export const metadata = {
  title: "How to read the capacity dashboard · NMM SOPs",
};

export default function HowToReadCapacityDashboardSop() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Sales Ops</p>
        <h1 className="sop-h1">How to read the capacity dashboard</h1>
        <p className="sop-lead">
          The capacity dashboard shows you, at a glance, how much room there is
          on the team&rsquo;s calendars for new bookings over the next few
          days. It pulls from every active closer&rsquo;s Google Calendar (via{" "}
          <code>ops@nomoremondays.io</code>) plus Calendly bookings, merges
          overlaps, and answers one question: <em>if a prospect wants to book
          a 60-minute call this week, can we offer them anything?</em>
        </p>
        <div className="sop-toolbar">
          <Link className="sop-btn" href="/apps/calendar">
            Open the dashboard
          </Link>
          <PrintButton />
        </div>
      </header>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">01</span>
          <h2 className="sop-h2">What the dashboard answers</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Before you tweak any filter, know what question
          you&rsquo;re asking.
        </p>
        <ul>
          <li>
            <strong>How many bookable slots</strong> exist in the date range
            you picked (cells where ≥ 1 closer is free).
          </li>
          <li>
            <strong>How that capacity is distributed across days</strong> — is
            Monday packed and Friday wide open?
          </li>
          <li>
            <strong>Which closer has the most free time</strong> — useful when
            assigning a hot lead.
          </li>
          <li>
            <strong>Where the conflicts cluster</strong> — fully-booked cells
            in the slot matrix show the squeeze points.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">02</span>
          <h2 className="sop-h2">The filter bar — what each control does</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> The filters change everything below them.
          Skim this once.
        </p>
        <ul>
          <li>
            <strong>Date range</strong> — defaults to the upcoming Monday
            through Friday in your selected timezone. Click either date to
            change it, or use the ‹ / › arrows to shift the whole range by the
            same number of days.
          </li>
          <li>
            <strong>Call length</strong> — 45 min or 60 min. Drives both the
            slot duration and how often slots open (45 min calls every 1 hour;
            60 min calls every 1 h 30 m).
          </li>
          <li>
            <strong>Show times in</strong> — render-only timezone selector.
            Defaults to Eastern (ET). All underlying data is stored in UTC; only
            display shifts.
          </li>
          <li>
            <strong>Filter by closer</strong> — click a name to toggle. Empty
            selection = whole team. Use this when you want to know{" "}
            <em>&ldquo;is Sam free Tuesday afternoon?&rdquo;</em> without
            other closers&rsquo; calendars cluttering the view.
          </li>
        </ul>
        <p className="sop-callout">
          <strong>Tip:</strong> Filter changes update the URL — bookmark a
          specific view (e.g. &ldquo;next 2 weeks, Sam + Alex only, 60 min&rdquo;)
          and share it.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">03</span>
          <h2 className="sop-h2">Headline KPIs at the top</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> The single-number snapshots that answer
          &ldquo;how cooked are we?&rdquo;
        </p>
        <ul>
          <li>
            <strong>Bookable slots</strong> — total cells where at least one
            closer is free.
          </li>
          <li>
            <strong>Available capacity</strong> — sum of free closers across
            all slots (1 closer free in 1 slot = 1 unit of capacity).
          </li>
          <li>
            <strong>Avg free closers per slot</strong> — bookable slots ÷ total
            slots, weighted. A drop here means the team is packed even when
            slots are technically open.
          </li>
          <li>
            <strong>Fully booked slots</strong> — slots where every selected
            closer is busy. Climbing fully-booked counts day-over-day is the
            early signal for a capacity squeeze.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">04</span>
          <h2 className="sop-h2">The two charts</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> KPIs are blunt — the charts show shape.
        </p>
        <ul>
          <li>
            <strong>Per-day available capacity</strong> (left): each bar is
            one day. Height = total free-closer-units that day. Spot patterns
            like &ldquo;every Wednesday tanks because of NSC&rdquo;.
          </li>
          <li>
            <strong>Per-closer split</strong> (right): how many bookable slots
            each closer has across the whole range. The closer with the tallest
            bar should get the next manual assignment.
          </li>
        </ul>
        <p>
          Both respect the current <strong>Filter by closer</strong> selection,
          so you can drill in or zoom out without leaving the page.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">05</span>
          <h2 className="sop-h2">The slot matrix — how to read a cell</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> This is where you find a specific opening.
        </p>
        <ul>
          <li>
            Rows are slot start times in the selected timezone. Columns are
            days in the range.
          </li>
          <li>
            Each cell shows <strong>how many closers are free</strong> at that
            slot. <code>0</code> = fully booked, higher numbers = more
            headroom.
          </li>
          <li>
            Hover or tap a cell to see <em>which</em> closers are free.
          </li>
          <li>
            Day totals at the top of each column = bookable slots that day
            (cells where ≥ 1 closer is free).
          </li>
        </ul>
        <p className="sop-callout">
          <strong>Quick read:</strong> a row that&rsquo;s mostly zeros tells
          you that time-of-day is consistently booked across the team — push
          back at that hour or move things around. A column that&rsquo;s
          mostly zeros tells you to avoid that day for new bookings.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">06</span>
          <h2 className="sop-h2">Drilling into a specific closer&rsquo;s week</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Sometimes the matrix isn&rsquo;t enough — you
          want to see <em>what</em> the closer is busy with.
        </p>
        <ol>
          <li>
            Click a closer&rsquo;s name on any chart or in the matrix tooltip.
            You&rsquo;ll land on their week timeline.
          </li>
          <li>
            The timeline shows every event from their calendar (titles
            included) plus Calendly bookings. Calendly bookings carry the
            event-type name and the invitee&rsquo;s answers to the booking
            form, where available.
          </li>
          <li>
            Use the date controls to scrub forward or back. The page does NOT
            carry your home-page filter state — it&rsquo;s a focused
            single-closer view.
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">07</span>
          <h2 className="sop-h2">The amber calendar coverage warning</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> The booking system trusts whatever it sees on
          a closer&rsquo;s calendar. If their calendar is mostly empty, the
          dashboard reports they&rsquo;re wide open — which means real
          prospects can be offered into time the closer is actually unavailable.
        </p>
        <ul>
          <li>
            The dashboard runs a check on every render: for each closer in the
            visible range, what percentage of the time is blocked on their
            calendar?
          </li>
          <li>
            A normal human with a nightly sleep block alone is{" "}
            <strong>~33% busy</strong>. Add lunch, meetings, gym, family time
            and a healthy calendar lands at 50%+.
          </li>
          <li>
            Anyone under <strong>25%</strong> coverage in the visible window
            gets flagged in the amber banner just below the filters. The
            banner lists each flagged closer with their coverage % and average
            hours blocked per day.
          </li>
        </ul>
        <p className="sop-callout">
          <strong>Action:</strong> send them the{" "}
          <a className="sop-link" href="/sops/closer-calendar-management">
            calendar management SOP
          </a>
          . If they aren&rsquo;t ready to fix it today, pause them via{" "}
          <a className="sop-link" href="/admin/closers">
            /admin/closers
          </a>{" "}
          (flip <em>Available</em> off) so the dashboard stops offering them
          until they&rsquo;ve set blockers up.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">08</span>
          <h2 className="sop-h2">When numbers look wrong</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> The dashboard is downstream of two systems that
          each have their own freshness lag. Knowing the lag tells you whether
          you&rsquo;re seeing a real problem or just stale data.
        </p>
        <ul>
          <li>
            <strong>Google Calendar → BigQuery</strong>: a sync job runs every{" "}
            <strong>5 minutes</strong>. Recent calendar edits typically appear
            within that window. If something is missing beyond ~10 minutes,
            ping ops.
          </li>
          <li>
            <strong>A closer appears who shouldn&rsquo;t / is missing</strong>:
            the active closer list lives in a Google Sheet (being moved into
            BigQuery directly). Tag the ops thread.
          </li>
          <li>
            <strong>Slot matrix says a closer is free but their calendar shows
            an event</strong>: check the event&rsquo;s &ldquo;Show me as&rdquo;
            setting — events marked <em>Free</em> are ignored by design.
          </li>
          <li>
            <strong>Time-zone confusion</strong>: the matrix renders in
            whatever TZ you&rsquo;ve selected. Storage is always UTC. Toggling
            the TZ shifts visual labels, not the underlying calendar truth.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">09</span>
          <h2 className="sop-h2">Related SOPs</h2>
        </div>
        <ul>
          <li>
            <Link className="sop-link" href="/sops/closer-calendar-management">
              Calendar management for closers
            </Link>{" "}
            — what every closer is supposed to be doing on their end. Read it
            once so you know what to ask a closer to fix when the dashboard
            shows something weird.
          </li>
          <li>
            <Link className="sop-link" href="/sops/new-closer-joins">
              When a new closer joins
            </Link>{" "}
            — the steps to add them so they appear here.
          </li>
          <li>
            <Link className="sop-link" href="/sops/closer-removed">
              When a closer is removed
            </Link>{" "}
            — how to take them off cleanly.
          </li>
        </ul>
      </section>

      <footer className="sop-footer">
        Spot a bug in the dashboard itself or have a feature ask? Open a PR or
        an issue on{" "}
        <a
          className="sop-link"
          href="https://github.com/artiverse-ai/no-more-mondays-apps"
        >
          no-more-mondays-apps
        </a>
        .
      </footer>
    </main>
  );
}
