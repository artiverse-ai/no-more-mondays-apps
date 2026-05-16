import Link from "next/link";
import { PrintButton } from "../PrintButton";

export const metadata = {
  title: "Solutions tabs (Alvaro & Ben) · NMM SOPs",
};

export default function SolutionsTabsSop() {
  return (
    <main className="sop-container">
      <header className="sop-hero">
        <p className="sop-eyebrow">No More Mondays · Reporting</p>
        <h1 className="sop-h1">
          Filling in the Solutions tabs &mdash; Marketing & Sales
        </h1>
        <p className="sop-lead">
          Every weekly report has two designated humans posting solutions
          in response to that week&rsquo;s flags: <strong>Alvaro</strong>{" "}
          on the Marketing Solutions tab and <strong>Ben</strong> on the
          Sales Solutions tab. The posts are first-class content
          alongside the AI insights, so leadership reads them as the
          response, not as buried comments. This SOP is the same for both
          of you &mdash; only the tab name differs.
        </p>
        <div className="sop-toolbar">
          <Link className="sop-btn" href="/dashboards/weekly-report">
            Open the dashboard
          </Link>
          <PrintButton />
        </div>
      </header>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">01</span>
          <h2 className="sop-h2">When to post</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Solutions are most useful when they land
          while the data is fresh in everyone&rsquo;s head.
        </p>
        <ul>
          <li>
            <strong>Monday recap:</strong> aim to post within 24h of the
            report dropping (so by Tuesday EOD). The Monday report has
            the deepest data &mdash; per-closer, per-setter, week-over-
            week deltas &mdash; so it&rsquo;s the most productive one to
            respond to.
          </li>
          <li>
            <strong>Thursday midweek check:</strong> post if anything
            mid-week needs flagging. If the week is uneventful, it&rsquo;s
            fine to leave the Thursday tab empty.
          </li>
          <li>
            You can post to <em>any</em> past snapshot &mdash; posts are
            keyed by report week, so an edit to an older week doesn&rsquo;t
            change anything else.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">02</span>
          <h2 className="sop-h2">Where to look before you write</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Your solutions should respond to specific
          flags in the data &mdash; not generic advice.
        </p>
        <ol>
          <li>
            Open the snapshot. Read the{" "}
            <strong>AI Strategic Insights</strong> tab first &mdash;
            Claude has already surfaced the 8&ndash;12 most important
            observations. Pay attention to cards tagged{" "}
            <code>flag</code> and <code>watch</code> in your area
            (Marketing for Alvaro, Sales for Ben).
          </li>
          <li>
            Check <strong>Tab 2 &middot; Latest Webinar</strong> for
            campaign-level signals (Marketing) or top-of-funnel quality
            shifts (Sales).
          </li>
          <li>
            If it&rsquo;s Monday, open <strong>Tab 3 &middot; Last
            Week&rsquo;s Sales</strong> for per-closer / per-setter
            patterns. The Bonus column in &ldquo;Setter Performance by
            Booking Mode&rdquo; is the most common Sales-Solutions
            trigger.
          </li>
          <li>
            Skim the <strong>Persistent KPI strip</strong> at the top
            &mdash; if Blended ROAS dropped below 4&times; or Cash/Booked
            Call moved 20%+ from last week, those usually need a
            response.
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">03</span>
          <h2 className="sop-h2">How to post</h2>
        </div>
        <ol>
          <li>
            On the report, click the <strong>Marketing Solutions</strong>{" "}
            (Alvaro) or <strong>Sales Solutions</strong> (Ben) tab.
          </li>
          <li>
            You&rsquo;ll see a green &ldquo;you can post here&rdquo;
            banner if you&rsquo;re signed in with the right email. If
            you see &ldquo;posting restricted to&hellip;&rdquo;,
            you&rsquo;re on the wrong account &mdash; sign out and back
            in with your editor email.
          </li>
          <li>
            Type your solution in the box and click <strong>Post
            solution</strong>. The post appears at the top of the list
            immediately.
          </li>
          <li>
            <strong>Edit</strong> a post by clicking it and hitting
            Edit; <strong>Delete</strong> with the Delete button. Posts
            persist across reloads.
          </li>
        </ol>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">04</span>
          <h2 className="sop-h2">What a good post looks like</h2>
        </div>
        <p className="sop-why">
          <strong>Why:</strong> Leadership skims these. The post needs to
          answer three questions: <em>what changed, what&rsquo;s the
          fix, who owns it.</em>
        </p>
        <p>Template:</p>
        <pre
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            overflow: "auto",
          }}
        >
{`Observation — one sentence with a number.
e.g. "Blended Cash ROAS dropped from 4.3× to 2.78× this week."

Action — what we're doing about it. Include the specific lever.
e.g. "Pausing the broad T1 campaign for 48h; re-launching with
the tighter lookalike audience Ben tested last cycle."

Owner & ETA — name + date.
e.g. "Alvaro · re-evaluation by Thu May 22."`}
        </pre>
        <p className="sop-callout">
          <strong>Keep it tight.</strong> 3&ndash;6 sentences is the
          sweet spot. If you have multiple solutions for one week, post
          each as a separate entry &mdash; not one long thread.
        </p>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">05</span>
          <h2 className="sop-h2">What NOT to post</h2>
        </div>
        <ul>
          <li>
            <strong>Don&rsquo;t paraphrase the AI insights.</strong> The
            insight cards are already on the page. Your post should add
            <em>what we&rsquo;re going to do</em>, not restate what we saw.
          </li>
          <li>
            <strong>Don&rsquo;t post &ldquo;will investigate&rdquo;
            placeholders.</strong> If you don&rsquo;t know the fix yet,
            wait until you do &mdash; or post the specific decision
            you&rsquo;re going to make and when.
          </li>
          <li>
            <strong>Don&rsquo;t post about the other tab&rsquo;s
            domain.</strong> If you (Alvaro) want to comment on a sales
            issue, ping Ben directly &mdash; Marketing Solutions is for
            marketing-side actions only.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">06</span>
          <h2 className="sop-h2">If posting isn&rsquo;t working</h2>
        </div>
        <ul>
          <li>
            <strong>&ldquo;Posting restricted&rdquo; banner:</strong>{" "}
            you&rsquo;re signed in with the wrong email. Marketing tab is
            keyed to Alvaro&rsquo;s email; Sales tab to Ben&rsquo;s.
            Admins can post to both as a fallback.
          </li>
          <li>
            <strong>Post button does nothing:</strong> the box is empty
            or whitespace-only. Type at least one non-blank character.
          </li>
          <li>
            <strong>HTTP error:</strong> hit Cmd/Ctrl+R, try again. If
            it keeps failing, screenshot the error and ping ops.
          </li>
        </ul>
      </section>

      <section className="sop-card">
        <div className="sop-card-title">
          <span className="sop-card-num">07</span>
          <h2 className="sop-h2">Related SOPs</h2>
        </div>
        <ul>
          <li>
            <Link className="sop-link" href="/sops/weekly-report">
              Weekly Report dashboard
            </Link>{" "}
            &mdash; the full tour of the report you&rsquo;re responding to.
          </li>
          <li>
            <Link className="sop-link" href="/sops/sales-performance-dashboard">
              Sales Performance dashboard
            </Link>{" "}
            &mdash; for Ben: the per-call detail behind a Monday rollup.
          </li>
          <li>
            <Link className="sop-link" href="/sops/webinar-performance-dashboard">
              Webinar Performance dashboard
            </Link>{" "}
            &mdash; for Alvaro: per-webinar drill-down behind a campaign
            flag.
          </li>
        </ul>
      </section>

      <footer className="sop-footer">
        Questions on the workflow? Ping ops in{" "}
        <a className="sop-link" href="mailto:ops@nomoremondays.io">
          #data
        </a>
        . Bugs go to{" "}
        <a className="sop-link" href="https://github.com/artiverse-ai/no-more-mondays-apps">
          no-more-mondays-apps
        </a>
        .
      </footer>
    </main>
  );
}
