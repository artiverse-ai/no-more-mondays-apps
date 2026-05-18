/**
 * Fivetran (and friends) → Slack via Google Apps Script
 * --------------------------------------------------------------
 * Watches the Gmail inbox of whoever owns this script, finds new
 * notification emails from Fivetran / Airbyte / dbt Cloud, and posts
 * a clean Slack message with the email content. Marks each email as
 * read so it only gets forwarded once.
 *
 * SETUP (one-time, ~5 min):
 *  1. Go to https://script.google.com → New project
 *  2. Replace the default Code.gs with this entire file
 *  3. Project Settings (left rail, gear icon) → Script properties:
 *       SLACK_WEBHOOK = https://hooks.slack.com/services/...
 *  4. Triggers (left rail, clock icon) → + Add Trigger:
 *       Function: forwardAlertsToSlack
 *       Event source: Time-driven
 *       Type: Minutes timer
 *       Interval: Every 5 minutes
 *     Save → authorize Gmail access (will pop up once)
 *  5. Done. Next Fivetran error email lands in Slack within 5 min.
 *
 * Test it: Run → forwardAlertsToSlack (manually) → check Slack channel
 * for the most recent matching email forwarded.
 */

// ─── Senders we forward (add/remove freely) ───────────────────
const SENDERS = [
  { from: "notifications@fivetran.com",  label: "Fivetran"  },
  { from: "noreply@airbyte.io",          label: "Airbyte"   },
  { from: "notifications@dbtlabs.com",   label: "dbt Cloud" },
  { from: "noreply@dbt-cloud.com",       label: "dbt Cloud" },
];

// ─── Project filter ───────────────────────────────────────────
// Fivetran/dbt emails include the workspace/account name. If your
// Gmail receives notifications from multiple Fivetran/dbt accounts,
// only forward the ones that match THESE strings (case-insensitive).
// Match is "body contains any of these" — keep a broad list of names
// that uniquely identify the NMM account.
//
// Leave empty ([]) to forward emails from ALL accounts (NOT recommended
// if you're in multiple Fivetran orgs).
const ACCOUNT_MATCHERS = [
  "No_More_Mondays",       // Fivetran account name (per dashboard)
  "no-more-mondays",       // BQ project name (often appears in dbt errors)
  "nomoremondays",         // Slug form
  "nmm",                   // Short form sometimes used in subject
];

// ─── Slack users to @-mention on alerts ──────────────────────
// Use Slack MEMBER IDs (not display names). To find one:
//   Slack → click a user's avatar → "View full profile" → "⋮" menu
//   → "Copy member ID". Looks like "U01ABC23DEF".
//   (Display names like @taziem look right in text but DON'T trigger
//    notifications via webhook — only member-ID syntax does.)
//
// Set to [] to disable mentions entirely.
const MENTION_USER_IDS = [
  "U0B39GWBQ78",       // Shahriar
  "U09BYUF1NAE",       // Taziem
];

// Only mention on these severities (saves noise on success/info emails).
// Options: "red", "orange", "green", "info".
const MENTION_ON_SEVERITIES = ["red", "orange"];

const ALERT_LABEL = "alerts-sent-to-slack"; // gmail label applied after forwarding

function forwardAlertsToSlack() {
  const webhook = PropertiesService.getScriptProperties().getProperty("SLACK_WEBHOOK");
  if (!webhook) throw new Error("Set Script property SLACK_WEBHOOK first.");

  // Make sure our marker label exists
  let label = GmailApp.getUserLabelByName(ALERT_LABEL);
  if (!label) label = GmailApp.createLabel(ALERT_LABEL);

  let forwarded = 0;
  for (const sender of SENDERS) {
    // Look for messages from this sender in the last 24h that aren't
    // already labeled (we use the label, not is:unread, so the user can
    // read the email in Gmail before we forward — both paths work).
    const query = `from:(${sender.from}) newer_than:1d -label:${ALERT_LABEL}`;
    const threads = GmailApp.search(query, 0, 20);

    for (const thread of threads) {
      for (const msg of thread.getMessages()) {
        if (msg.getFrom().toLowerCase().indexOf(sender.from.toLowerCase()) === -1) continue;
        if (!matchesAccount(msg)) {
          console.log(`Skipping (not NMM account): ${msg.getSubject()}`);
          continue;
        }
        try {
          postToSlack(webhook, msg, sender.label);
          forwarded++;
        } catch (err) {
          // Log to Apps Script Executions, but don't crash the loop —
          // one bad email shouldn't block forwarding the rest.
          console.error(`Failed to forward ${msg.getSubject()}: ${err}`);
        }
      }
      thread.addLabel(label);  // mark whole thread so we don't re-forward
    }
  }
  console.log(`Forwarded ${forwarded} alert(s) to Slack.`);
}

/** Returns true if the email looks like it's from the NMM account. If
 *  ACCOUNT_MATCHERS is empty, returns true (forward everything). */
function matchesAccount(msg) {
  if (ACCOUNT_MATCHERS.length === 0) return true;
  const haystack = (msg.getSubject() + " " + (msg.getPlainBody() || "")).toLowerCase();
  return ACCOUNT_MATCHERS.some((m) => haystack.indexOf(m.toLowerCase()) !== -1);
}

function postToSlack(webhook, msg, sourceLabel) {
  const subject = msg.getSubject();
  const sender = msg.getFrom();
  const sentAt = msg.getDate();

  // Strip HTML, collapse whitespace, cap length for Slack readability
  const bodyRaw = (msg.getPlainBody() || htmlToPlain(msg.getBody()))
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const body = bodyRaw.length > 2500 ? bodyRaw.slice(0, 2500) + "\n…(truncated)" : bodyRaw;

  // Severity emoji from subject keywords
  const lower = subject.toLowerCase();
  let emoji = "📩";
  let severity = "info";
  if (lower.match(/error|fail|stalled|broken/))      { emoji = "🔴"; severity = "red"; }
  else if (lower.match(/warning|warn|stale|slow/))   { emoji = "🟠"; severity = "orange"; }
  else if (lower.match(/success|recovered|resolved|ok\b/)) { emoji = "✅"; severity = "green"; }

  // Build the @-mention prefix only on the severities we care about.
  // Slack mention syntax in webhooks: <@U01ABC23DEF>.
  const shouldMention =
    MENTION_USER_IDS.length > 0 && MENTION_ON_SEVERITIES.indexOf(severity) !== -1;
  const mentionPrefix = shouldMention
    ? MENTION_USER_IDS.map((id) => `<@${id}>`).join(" ") + " "
    : "";

  const payload = {
    text: `${mentionPrefix}${emoji} ${sourceLabel}: ${subject}`,
    blocks: [
      // Mention block lives ABOVE the header so it shows up clearly at
      // the top of the message + triggers the notification bell.
      ...(shouldMention
        ? [{
            type: "section",
            text: { type: "mrkdwn", text: mentionPrefix.trim() + " — heads up 👇" },
          }]
        : []),
      {
        type: "header",
        text: { type: "plain_text", text: `${emoji} ${sourceLabel}: ${truncate(subject, 140)}` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: "```" + body + "```" },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🕒 ${Utilities.formatDate(sentAt, "Etc/UTC", "yyyy-MM-dd HH:mm 'UTC'")}  ·  📧 ${escapeMd(sender)}`,
          },
        ],
      },
    ],
  };

  const resp = UrlFetchApp.fetch(webhook, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(`Slack returned ${code}: ${resp.getContentText()}`);
  }
}

// ─── helpers ──────────────────────────────────────────────────
function htmlToPlain(html) {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}
function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function escapeMd(s) { return String(s).replace(/[<>&]/g, ""); }
