#!/bin/bash
# Wrapper for the weekly-insights generator. Sources secrets, uses the
# venv python, logs to ~/data_audit/logs/weekly_insights.log.
#
# Cron entry (every minute):
#   * * * * * /home/$USER/no-more-mondays-apps/data_audit/weekly_insights/generate_insights_wrapper.sh
#
# Or call directly to test:
#   bash generate_insights_wrapper.sh

set -euo pipefail

USER_HOME="/home/${USER:-$(whoami)}"
LOG="$USER_HOME/data_audit/logs/weekly_insights.log"
SECRETS="$USER_HOME/.slack_secrets"

# Repo layout: this script lives at <repo>/data_audit/weekly_insights/.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCRIPT="$SCRIPT_DIR/generate_insights.py"

VENV_PYTHON="$USER_HOME/data_audit/venv/bin/python3"
if [ ! -x "$VENV_PYTHON" ]; then
  echo "ERROR: venv python not found at $VENV_PYTHON — run the data_audit venv setup." >&2
  exit 2
fi

mkdir -p "$(dirname "$LOG")"

# Use a lock so two cron ticks don't overlap (each generation can take 30-120s).
LOCK="$USER_HOME/data_audit/.weekly_insights.lock"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -u +%FT%TZ) SKIP — previous run still in progress" >> "$LOG"
  exit 0
fi

# Secrets file holds CLAUDE_CODE_OAUTH_TOKEN, BQ_PROJECT, etc.
# shellcheck disable=SC1090
[ -f "$SECRETS" ] && source "$SECRETS"

if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "$(date -u +%FT%TZ) ERROR: CLAUDE_CODE_OAUTH_TOKEN not set" >> "$LOG"
  exit 3
fi

echo "$(date -u +%FT%TZ) START weekly_insights" >> "$LOG"
set +e
"$VENV_PYTHON" "$SCRIPT" >> "$LOG" 2>&1
RC=$?
set -e
echo "$(date -u +%FT%TZ) END   weekly_insights rc=$RC" >> "$LOG"
exit "$RC"
