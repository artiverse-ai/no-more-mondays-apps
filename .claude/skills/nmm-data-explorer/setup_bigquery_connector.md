# Setting Up the BigQuery Connector

This file is read by **Claude** when you don't yet have BigQuery access, or
when your session has expired. Claude will walk you through it step by step
— you don't need to read this on your own first. But you can if you want
the lay of the land.

**Roughly 2–5 minutes** if you already have everything Ops has shared with you.

---

## Prerequisites — confirm these first

Before doing anything in Claude, make sure you have:

| Item | How to get it |
|---|---|
| A **`@nomoremondays.io` Google account** | Ask Ops if you don't have one. Personal Gmail accounts will not work — Google blocks them from organisation BigQuery projects. |
| **BigQuery read access** on the `no-more-mondays-analytics` project | Ask Ops to add you as a **BigQuery User** on the `no-more-mondays-analytics` GCP project. They'll need your `@nomoremondays.io` email. |
| The **OAuth Client ID** for connecting Claude to BigQuery | Ops will DM these to you — they are NOT in this file, the repo, or any chat history. If you don't have them yet, ask in `#growth-ops`. |
| The **OAuth Client Secret** | Same as above. |

If any of these are missing, **stop** and get them from Ops before continuing.
Claude will wait — just tell it "I need to grab credentials from Ops, hold on."

---

## Connecting on Claude.ai (web)

1. Open [claude.ai](https://claude.ai) and sign in (any Claude account is
   fine — it doesn't have to match your NMM Google account).
2. Click your profile picture (top-right) → **Settings**.
3. Find the **Connectors** section (or **Integrations** — Anthropic
   occasionally renames; look for the section that lists things like
   "Google Drive", "Gmail", "Notion", "Slack").
4. Click **Add connector** (or **Add new** / **+**).
5. Pick **Google Cloud BigQuery** from the list.
6. You'll see fields for:
   - **Client ID** — paste the value Ops shared with you.
   - **OAuth Client Secret** — paste the value Ops shared with you.
7. Click **Connect** / **Authenticate**.
8. A Google sign-in window will open. **Sign in with your
   `@nomoremondays.io` account.** (If Google offers other accounts you're
   signed into, pick the NMM one — not your personal Gmail.)
9. Approve the permissions Claude asks for (read-only access to your
   BigQuery data).
10. You'll return to Claude with the connector showing **Connected**.

## Connecting on Claude Desktop

The steps are nearly identical:

1. Open Claude Desktop → **Settings** → **Connectors** (or
   **Integrations**).
2. Add **Google Cloud BigQuery**.
3. Paste Client ID + Secret.
4. Sign in with `@nomoremondays.io`.
5. Confirm it shows **Connected**.

## After connecting — confirm it works

Back in the chat, tell Claude: **"Are you connected to BigQuery?"**

Claude will run a tiny test query (`SELECT 1 AS ok, CURRENT_TIMESTAMP()`)
and confirm. If it succeeds, you're done.

---

## Re-authenticating after a session timeout

Google sessions expire on a schedule (think hours to days). When that
happens, Claude will surface an auth error. Re-connect:

1. Settings → Connectors → **Google Cloud BigQuery**.
2. Click **Reconnect** (or **Disconnect** then **Connect** again).
3. Sign in with your `@nomoremondays.io` account.
4. Confirm with Claude: "Are you connected to BigQuery?"

You typically only need to do this once a day or once a week. It's not a
permission problem — it's just how Google OAuth works.

---

## Troubleshooting

| Symptom | What's actually wrong | Fix |
|---|---|---|
| "Google won't let me sign in with my personal Gmail" | Correct — Google restricts the connector to organisation accounts. | Use your `@nomoremondays.io` account. If you don't have one, ask Ops. |
| Sign-in succeeds, but Claude says "permission denied on BigQuery" | Your Google account isn't on the project. | Ask Ops to add you as a **BigQuery User** on the `no-more-mondays-analytics` GCP project. |
| Claude says "tool not found" or "no BigQuery connector" | The connector was never added on this Claude account. | Go through "Connecting on Claude.ai" above. |
| "Invalid Client ID" or "Client Secret rejected" | You pasted the wrong value, or the secret has rotated. | Re-check what Ops sent. If still failing, DM Ops — they may need to rotate or re-issue. |
| It connected but queries fail with "billing not enabled" | Misconfigured at the GCP project level. | Tell Ops — this is not something you can fix from your end. |
| Re-authentication loops you back to sign-in repeatedly | Browser cookie issue. | Try a private/incognito window, sign in there, retry. |

---

## What Claude can do once you're connected

- Run **read-only** queries against the warehouse. It cannot create,
  modify, or delete data.
- See the **whole warehouse** — every dataset, every table you have access
  to.
- Take a few seconds per question. Anything that needs heavy joins (like
  customer-journey lookups) may take 10–20 seconds. That's normal.

If you ever feel like Claude is querying things it shouldn't, you can
disconnect the connector at any time from Settings → Connectors.
