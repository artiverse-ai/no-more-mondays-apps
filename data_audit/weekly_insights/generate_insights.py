#!/usr/bin/env python3
"""
Claim one pending weekly-report snapshot, fetch its dashboard data, call
Claude Code headlessly to produce 8-12 insight cards, and persist them.

Designed to run from cron every minute. Exits 0 on success or when there's
nothing to do — only non-zero on a hard error (BQ unreachable, etc).

Env vars:
  CLAUDE_CODE_OAUTH_TOKEN   — required; bills against the Max subscription
  WEEKLY_INSIGHTS_PROMPT    — optional override path; default search order:
                              ~/data_audit/prompts/weekly_insights.md
                              <repo>/prompts/weekly_insights.md
  CLAUDE_BIN                — optional; defaults to "claude" on PATH
"""

from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess
import sys
from typing import Any

import bq_data

REPO_PROMPT = pathlib.Path(__file__).resolve().parents[2] / "prompts" / "weekly_insights.md"
VM_PROMPT = pathlib.Path.home() / "data_audit" / "prompts" / "weekly_insights.md"

VALID_TONES = {"ctx", "win", "watch", "flag", "fix", "fwd"}

CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
CLAUDE_TIMEOUT_SEC = int(os.environ.get("CLAUDE_TIMEOUT_SEC", "300"))


def _log(msg: str) -> None:
    print(msg, flush=True)


def find_prompt_template() -> str:
    override = os.environ.get("WEEKLY_INSIGHTS_PROMPT")
    candidates = []
    if override:
        candidates.append(pathlib.Path(override))
    candidates += [VM_PROMPT, REPO_PROMPT]
    for p in candidates:
        if p.is_file():
            _log(f"Using prompt template: {p}")
            return p.read_text(encoding="utf-8")
    raise FileNotFoundError(
        f"No prompt template found. Tried: {[str(c) for c in candidates]}"
    )


def assemble_prompt(template: str, payload: dict[str, Any]) -> str:
    """Concatenate the system prompt with the data payload."""
    data_block = json.dumps(payload, indent=2, default=str)
    return (
        template.rstrip()
        + "\n\n## Report data (live BigQuery)\n\n```json\n"
        + data_block
        + "\n```\n"
    )


def run_claude(prompt: str) -> str:
    """Invoke Claude Code in headless mode, return its raw stdout."""
    if not os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
        raise RuntimeError(
            "CLAUDE_CODE_OAUTH_TOKEN env var is not set — claude -p will fail."
        )
    cmd = [CLAUDE_BIN, "-p", prompt, "--output-format", "text"]
    _log(f"Calling: {CLAUDE_BIN} -p <…{len(prompt)} chars…> --output-format text")
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=CLAUDE_TIMEOUT_SEC,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"claude exited {proc.returncode}.\nstderr: {proc.stderr[:500]}"
        )
    return proc.stdout


def extract_json_array(raw: str) -> list[dict[str, Any]]:
    """
    Find and parse the first top-level JSON array in Claude's response.

    Claude sometimes wraps output in markdown code fences despite the prompt,
    so we strip those before parsing. If parsing fails, we return the raw
    error along with the offending text so the failure message is useful.
    """
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    # Locate the outermost [ ... ] if there's surrounding prose.
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError(f"Could not locate a JSON array in output:\n{raw[:500]}")
    candidate = text[start : end + 1]
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"JSON parse failed: {e}. Candidate (first 500 chars):\n{candidate[:500]}"
        ) from e
    if not isinstance(parsed, list):
        raise ValueError("Top-level value is not an array")
    return parsed


def validate_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not (4 <= len(items) <= 15):  # Soft bounds; prompt asks for 8-12.
        raise ValueError(f"Expected 4-15 insight cards, got {len(items)}")
    cleaned = []
    for i, it in enumerate(items):
        if not isinstance(it, dict):
            raise ValueError(f"Item {i} is not an object: {it!r}")
        for k in ("tone", "tag", "title", "body"):
            if k not in it or not isinstance(it[k], str) or not it[k].strip():
                raise ValueError(f"Item {i} missing/empty field {k!r}")
        if it["tone"] not in VALID_TONES:
            raise ValueError(f"Item {i} has invalid tone {it['tone']!r}")
        cleaned.append({
            "tone": it["tone"],
            "tag": it["tag"].strip(),
            "title": it["title"].strip(),
            "body": it["body"].strip(),
            "position": int(it.get("position", i)),
        })
    return cleaned


def process_one() -> int:
    """Process a single pending snapshot. Returns 0 = work done, 1 = idle."""
    snap = bq_data.claim_pending()
    if snap is None:
        _log("No pending snapshots.")
        return 1

    slug = snap["slug"]
    _log(f"Claimed snapshot: {slug}")

    try:
        template = find_prompt_template()
        payload = bq_data.assemble_report_payload(slug)
        prompt = assemble_prompt(template, payload)

        raw = run_claude(prompt)
        items = validate_items(extract_json_array(raw))
        n = bq_data.insert_insights(slug, items)
        bq_data.mark_succeeded(slug)
        _log(f"OK: {n} insights written for {slug}")
        return 0
    except Exception as e:  # noqa: BLE001
        msg = f"{type(e).__name__}: {e}"
        _log(f"FAILED {slug}: {msg}")
        try:
            bq_data.mark_failed(slug, msg)
        except Exception as inner:  # noqa: BLE001
            _log(f"Also failed to mark_failed: {inner}")
        return 0  # exit 0 so cron doesn't treat as a script failure


def main() -> int:
    try:
        return process_one()
    except Exception as e:  # noqa: BLE001
        _log(f"FATAL: {type(e).__name__}: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
