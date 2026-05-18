# Fivetran → Slack via Google Apps Script

Forwards Fivetran (and Airbyte / dbt Cloud) notification emails to a
Slack channel via the channel's incoming webhook. No infrastructure to
host — runs free in Google's Apps Script runtime, fires every 5 minutes.

## Why this and not a custom BQ checker?

For Fivetran/Airbyte/dbt **sync failures**, the vendor already emails
you the error. Forwarding that email is simpler than rebuilding the
detection — exact same message, zero data work.

For data issues those emails DON'T catch (sync succeeded but inserted
0 rows, downstream dbt model stale, AI insights silently empty),
that's where the separate BQ freshness checker lives (`data_audit/
pipeline_alerts/`).

## Setup (one-time, ~5 min)

1. **Make sure the Gmail account that owns the script is the one
   receiving Fivetran emails** (check by searching `from:notifications@fivetran.com` in Gmail).
2. Open https://script.google.com → **New project**
3. Name it: `Fivetran → Slack alerts`
4. Delete the default `function myFunction()` stub
5. Paste the contents of `Code.gs` from this folder
6. Left rail → ⚙️ **Project Settings** → scroll to **Script Properties**
   → **+ Add script property**
     - Key: `SLACK_WEBHOOK`
     - Value: paste the `https://hooks.slack.com/services/...` URL
   → **Save script properties**
7. Left rail → ⏰ **Triggers** → **+ Add Trigger** (bottom right)
     - Function: `forwardAlertsToSlack`
     - Deployment: Head
     - Event source: Time-driven
     - Type of time based trigger: Minutes timer
     - Select minute interval: Every 5 minutes
   → **Save**
8. Google will prompt for Gmail access — review and **Allow**.

Done. Next matching email lands in Slack within 5 minutes.

## Test it manually

In the editor:
1. Top toolbar → Function dropdown → select `forwardAlertsToSlack`
2. Click **Run**
3. Watch the Execution log (bottom of editor) — should print
   `Forwarded N alert(s) to Slack.`
4. Check the Slack channel for the message.

## Which senders are forwarded

Edit the `SENDERS` array at the top of `Code.gs`:

```javascript
const SENDERS = [
  { from: "notifications@fivetran.com",  label: "Fivetran"  },
  { from: "noreply@airbyte.io",          label: "Airbyte"   },
  { from: "notifications@dbtlabs.com",   label: "dbt Cloud" },
  { from: "noreply@dbt-cloud.com",       label: "dbt Cloud" },
];
```

Add any other vendor that emails alerts. Run-time is per-sender so
adding extras has no performance cost.

## How it avoids duplicate Slack messages

Each forwarded thread gets the Gmail label `alerts-sent-to-slack`.
The next run filters with `-label:alerts-sent-to-slack`, so previously-
forwarded threads are skipped even if you don't mark the email as read.

## Severity emoji mapping

The script picks an emoji from subject keywords:

| Subject keyword | Emoji |
|---|---|
| `error`, `fail`, `stalled`, `broken` | 🔴 |
| `warning`, `warn`, `stale`, `slow` | 🟠 |
| `success`, `recovered`, `resolved`, `ok ` | ✅ |
| anything else | 📩 |

## Where to find the webhook URL

The Slack incoming webhook URL was shared in chat (May 2026). It
should be treated as a secret — keep it in the Apps Script property
store only. Never commit to git.

If the webhook is ever exposed, rotate it: Slack workspace → Apps →
Incoming Webhooks → delete + create new → update `SLACK_WEBHOOK`
property.
