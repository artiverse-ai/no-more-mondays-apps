#!/bin/bash
# Wrapper for the weekly-insights generator. Sources secrets, uses the
# venv python, logs to ~/data_audit/logs/weekly_insights.log.
#
# Cron-launched every minute (* * * * *). Inside each minute, the wrapper
# polls BQ every 10 seconds for up to ~55 seconds so a snapshot created at
# t=03s is picked up by t≤13s instead of waiting up to 60s for the next
# cron tick. flock guards against parallel runs across cron ticks.
#
# Cron entry:
#   * * * * * /home/$USER/nmm-insights/data_audit/weekly_insights/generate_insights_wrapper.sh

set -euo pipefail

USER_HOME="/home/${USER:-$(whoami)}"
LOG="$USER_HOME/data_audit/logs/weekly_insights.log"
SECRETS="$USER_HOME/.slack_secrets"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$SCRIPT_DIR/generate_insights.py"

VENV_PYTHON="$USER_HOME/data_audit/venv/bin/python3"
if [ ! -x "$VENV_PYTHON" ]; then
  echo "ERROR: venv python not found at $VENV_PYTHON — run the data_audit venv setup." >&2
  exit 2
fi

mkdir -p "$(dirname "$LOG")"

# Lock: one wrapper instance per VM. Subsequent cron ticks during a long
# Claude call will see the lock and exit immediately with "SKIP".
LOCK="$USER_HOME/data_audit/.weekly_insights.lock"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -u +%FT%TZ) SKIP — previous run still in progress" >> "$LOG"
  exit 0
fi

# shellcheck disable=SC1090
[ -f "$SECRETS" ] && source "$SECRETS"

if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "$(date -u +%FT%TZ) ERROR: CLAUDE_CODE_OAUTH_TOKEN not set" >> "$LOG"
  exit 3
fi

# Poll for the rest of this cron minute. Each iteration calls the
# Python script which itself returns within seconds when nothing is
# pending. If Claude is invoked, the iteration can take 30-180s; in that
# case the loop naturally exits at the next bound check.
END=$((SECONDS + 55))
while [ "$SECONDS" -lt "$END" ]; do
  echo "$(date -u +%FT%TZ) START weekly_insights" >> "$LOG"
  set +e
  "$VENV_PYTHON" "$SCRIPT" >> "$LOG" 2>&1
  RC=$?
  set -e
  echo "$(date -u +%FT%TZ) END   weekly_insights rc=$RC" >> "$LOG"
  # Sleep 10s between checks unless we're past the budget.
  if [ "$SECONDS" -lt "$END" ]; then
    sleep 10
  fi
done
