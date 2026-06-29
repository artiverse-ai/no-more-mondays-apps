#!/bin/bash
# Wrapper for the weekly-insights generator. Sources secrets, uses the
# venv python, logs to ~/data_audit/logs/weekly_insights.log.
#
# Cron-launched every minute (* * * * *). Runs the generator once per tick
# (a snapshot is picked up within ~60s). flock guards against parallel runs
# across cron ticks when a generation spans more than a minute.
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

# One generation attempt per cron tick. (Previously this polled BigQuery every
# 10s for ~55s — ~6 queue-poll round-trips per minute — which, on an
# almost-always-empty queue, was the single largest source of BigQuery jobs on
# the project. Insight generation is admin-triggered and takes minutes, so up
# to ~60s pickup latency is irrelevant.) flock above still prevents overlap
# with a long-running generation that spans the next cron tick.
echo "$(date -u +%FT%TZ) START weekly_insights" >> "$LOG"
set +e
"$VENV_PYTHON" "$SCRIPT" >> "$LOG" 2>&1
RC=$?
set -e
echo "$(date -u +%FT%TZ) END   weekly_insights rc=$RC" >> "$LOG"
