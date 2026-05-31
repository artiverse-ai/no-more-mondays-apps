# NMM Data Explorer — Installation Guide

A Claude skill that lets leadership and ops ask plain-language questions about
the No More Mondays business — leads, attendance, calls booked, deals closed,
ad performance, customer journeys — and get answers pulled live from the
company data warehouse.

**Audience:** anyone at NMM with a `@nomoremondays.io` Google account and
permission to read the analytics warehouse.

**Surfaces:** designed for **Claude.ai (web)** and **Claude Desktop**. It will
also work in Claude Code if you're an engineer, but the language and the
no-jargon framing are tuned for non-engineering users.

---

## What you need before installing

1. **A `@nomoremondays.io` Google account.** Personal Gmail accounts will not
   work — Google restricts the BigQuery connector to organisation accounts.
2. **BigQuery read access** on the `no-more-mondays-analytics` project.
   - If you don't have it: message Ops and ask them to add you as a
     "BigQuery User" on the `no-more-mondays-analytics` project. Tell them
     which `@nomoremondays.io` email to grant access to.
3. **The Google Cloud BigQuery OAuth Client ID + Secret** for connecting
   Claude to BigQuery.
   - Don't have them? DM Ops. They will share securely.
4. **A Claude.ai account or Claude Desktop installed.** The skill works on
   both.

---

## Installing the skill on Claude.ai (web)

1. Download this skill folder as a `.zip`:
   - Open the public **no-more-mondays-apps** repo on GitHub:
     <https://github.com/artiverse-ai/no-more-mondays-apps/tree/main/.claude/skills/nmm-data-explorer>
   - Easiest way: use the [download-directory.github.io](https://download-directory.github.io/)
     helper — paste the URL above and it returns a clean zip of just the
     skill folder. Or `git clone` the apps repo and zip the folder
     manually.
   - The zip should contain `SKILL.md` at the top level (plus the other 5
     `.md` files alongside it). **It must NOT be a folder-inside-a-folder.**
2. Open [claude.ai](https://claude.ai) and sign in.
3. Click your profile picture (top-right) → **Settings** → **Capabilities**
   → **Skills** (the name and exact path may vary as Anthropic updates the
   UI; look for the "Skills" section).
4. Click **Upload skill** and select your `.zip`.
5. Once it appears in the list, toggle it **on**.
6. Verify by typing `/nmm-data-explorer` in any new conversation — Claude
   should greet you with example questions.

## Installing the skill on Claude Desktop

1. Download the skill folder as described above (you can also keep it as an
   unzipped folder for Desktop).
2. Open Claude Desktop → **Settings** → **Skills** (location may vary by
   version).
3. Either drag-and-drop the folder into the Skills pane, or click **Add
   Skill** and point at the folder.
4. Verify by typing `/nmm-data-explorer` in a new chat.

## Using the skill in Claude Code (engineers only)

Engineers working in this repo with Claude Code don't need to install
anything — the skill is already in `.claude/skills/` and Claude Code
auto-discovers it. Type `/nmm-data-explorer` in any Claude Code session
running from the repo root. (There is also a sibling `run-bq-query` skill
in the same folder that's purpose-built for engineer-style warehouse
spot-checks during dbt development.)

---

## Connecting BigQuery (once per user, per device)

After installing the skill, you also need to connect Claude to BigQuery. The
skill itself will detect missing or expired BigQuery access and walk you
through this — but if you want to do it before your first question:

See `setup_bigquery_connector.md` in this skill folder. Short version:

1. Claude.ai → **Settings → Connectors → Add connector → Google Cloud
   BigQuery**.
2. Paste the **Client ID** and **OAuth Client Secret** (DM Ops if you don't
   have them).
3. Click **Connect** and sign in with your `@nomoremondays.io` Google
   account.
4. Test by asking Claude "Are you connected to BigQuery?" — it will run a
   tiny ping query.

---

## Updates

When the warehouse schema or business rules change, this skill needs to be
re-uploaded:

1. Pull the latest from the `no-more-mondays-analytics` repo.
2. Re-zip `.claude/skills/nmm-data-explorer/`.
3. Re-upload on claude.ai (it will overwrite the prior version) or replace
   the Desktop folder.

If a leader asks a question and the answer feels off — especially if Claude
mentions a column or rule that doesn't match the spec — that's a signal that
the skill is out of date. Tell Ops.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/nmm-data-explorer` does nothing | The skill isn't enabled. Recheck the Skills settings on claude.ai or Claude Desktop. |
| Claude says "BigQuery connector not available" | The connector hasn't been added. Open `setup_bigquery_connector.md` and follow the steps. |
| Claude says "session expired" / asks to re-authenticate | Normal — Google sessions time out. Settings → Connectors → Google Cloud BigQuery → reconnect with your `@nomoremondays.io` account. |
| You get permission errors after authenticating | Your Google account doesn't have BigQuery access on the project. Ask Ops to add you. |
| Claude gives a number that's clearly wrong | Don't trust silently — push back. Many warehouse caveats are real (cash collected ≠ banked cash; dispositioning lag; attribution windows). The skill is supposed to flag them; if it didn't, tell Ops so the skill can be tightened. |

---

## What this skill is NOT

- Not a substitute for the dashboards in Looker Studio. For routine reporting,
  use the dashboards. Use this skill when the dashboard doesn't answer your
  question.
- Not authorised to write data. It can only read from the warehouse.
- Not a real-time view of GoHighLevel or Airtable — the warehouse refreshes
  on a schedule (typically a few times a day). Very recent activity may not
  be there yet.

---

## Questions

Ask in `#growth-ops` Slack.
