# Weekly Insights — VM install

Generates the Strategic Insights cards for `/dashboards/weekly-report/<slug>`
by calling Claude Code headlessly against the live BigQuery report data.

## How it fits together

1. Admin creates (or "Regenerate"s) a snapshot in the Vercel app.
2. The API row in `nmm_calendar.weekly_report_snapshots` is set to
   `insights_generation_status = 'pending'`.
3. **This script**, run every minute via cron on the GCP VM, claims one
   pending row, fetches its dashboard data, asks Claude for 8–12 insight
   cards, and INSERTs them into `nmm_calendar.weekly_report_insights`.
4. The dashboard auto-polls every 5s and renders the new cards as soon as
   status flips to `'succeeded'`.

## One-time install (on the VM)

This assumes you've already followed the data-audit-vm setup (Node 20,
Python venv at `~/data_audit/venv`, `claude` on PATH, `~/.slack_secrets`
loaded from cron).

```bash
# 1. Clone (or pull) the repo on the VM
cd ~
git clone https://github.com/<org>/no-more-mondays-apps.git   # first time only
cd no-more-mondays-apps && git pull

# 2. Add the Claude Code OAuth token + BQ project to ~/.slack_secrets
#    (the wrapper sources this file before each run)
cat >> ~/.slack_secrets << 'EOF'
export CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-..."   # rotate via `claude setup-token`
export BQ_PROJECT="customgpt-analytics"             # override if your project differs
export BQ_DATASET="nmm_calendar"
export BQ_MART_DATASET="dbt_tuddin"
EOF
chmod 600 ~/.slack_secrets

# 3. Smoke-test
source ~/.slack_secrets
~/data_audit/venv/bin/python3 ~/no-more-mondays-apps/data_audit/weekly_insights/generate_insights.py

# 4. Install the cron entry (runs every minute; uses flock so no overlap)
( crontab -l 2>/dev/null; \
  echo "* * * * * /home/$USER/no-more-mondays-apps/data_audit/weekly_insights/generate_insights_wrapper.sh" \
) | crontab -
crontab -l
```

## Override the prompt without committing

The script reads the prompt template in this order:

1. `$WEEKLY_INSIGHTS_PROMPT` (if set)
2. `~/data_audit/prompts/weekly_insights.md` (VM-local override)
3. `<repo>/prompts/weekly_insights.md` (committed default)

To experiment on the VM without touching the repo:

```bash
mkdir -p ~/data_audit/prompts
cp ~/no-more-mondays-apps/prompts/weekly_insights.md ~/data_audit/prompts/weekly_insights.md
# edit ~/data_audit/prompts/weekly_insights.md, save, next cron run picks it up
```

Once you're happy with the changes, copy them back into the repo and commit.

## Logs / debugging

```bash
tail -f ~/data_audit/logs/weekly_insights.log

# Manually re-queue a snapshot (admin button does the same thing)
bq query --use_legacy_sql=false "
  UPDATE \`customgpt-analytics.nmm_calendar.weekly_report_snapshots\`
  SET insights_generation_status = 'pending', insights_generation_error = NULL
  WHERE slug = '2026-05-14'
"

# Inspect the queue
bq query --use_legacy_sql=false "
  SELECT slug, insights_generation_status, insights_generation_error,
         FORMAT_TIMESTAMP('%F %T', insights_generated_at) AS generated_at
  FROM \`customgpt-analytics.nmm_calendar.weekly_report_snapshots\`
  WHERE deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 10
"
```

## Common failures

| Symptom | Fix |
| --- | --- |
| `CLAUDE_CODE_OAUTH_TOKEN not set` | Token missing from `~/.slack_secrets`. Regenerate with `claude setup-token` on your laptop, copy the new value in, `chmod 600`. |
| `claude exited 1` with rate-limit | Max subscription quota hit (5-hour window). Script flips status back to `pending` via mark_failed — cron will retry on the next tick. If failing repeatedly, wait for window reset. |
| `Could not locate a JSON array` | Claude returned prose. Check `~/data_audit/logs/weekly_insights.log` for the raw output. Usually means the prompt drift — re-pull the repo or edit the override file. |
| `BQ insert errors` | Schema drift on `weekly_report_insights`. The Next.js app's `ensure()` is canonical — visit the dashboard once after a deploy so it auto-runs the CREATE/ALTER. |
