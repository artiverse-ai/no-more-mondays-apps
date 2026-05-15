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

# Model selection. We default to Sonnet 4.6 — strong reasoning + reliable
# math for our task (produce structured JSON with cited numbers from the
# supplied data) while staying within the user's 3-5 min latency budget.
# Haiku is faster but more error-prone on math; Opus is more capable but
# typically exceeds the latency budget on a 14K-char prompt. Sonnet hits
# the sweet spot.
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "sonnet")
CLAUDE_FALLBACK_MODEL = os.environ.get("CLAUDE_FALLBACK_MODEL", "opus")


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


CLAUDE_MAX_ATTEMPTS = int(os.environ.get("CLAUDE_MAX_ATTEMPTS", "3"))


def _run_claude_once(prompt: str) -> str:
    """Single subprocess invocation of `claude -p`. Raises on non-zero
    exit or timeout. Caller layers retry on top.
    """
    if not os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
        raise RuntimeError(
            "CLAUDE_CODE_OAUTH_TOKEN env var is not set — claude -p will fail."
        )
    cmd = [
        CLAUDE_BIN, "-p", prompt,
        "--output-format", "text",
        "--model", CLAUDE_MODEL,
        "--fallback-model", CLAUDE_FALLBACK_MODEL,
    ]
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


def run_claude(prompt: str) -> str:
    """Retry-wrapped Claude call. Transient failures (rate limit, network
    blip, occasional malformed parse upstream) get a second + third
    attempt with exponential backoff before bubbling the exception."""
    _log(
        f"Calling: {CLAUDE_BIN} -p <…{len(prompt)} chars…> "
        f"--model {CLAUDE_MODEL} (fallback {CLAUDE_FALLBACK_MODEL})"
    )
    last_exc: Exception | None = None
    import time
    for attempt in range(1, CLAUDE_MAX_ATTEMPTS + 1):
        try:
            return _run_claude_once(prompt)
        except Exception as e:  # noqa: BLE001
            last_exc = e
            if attempt < CLAUDE_MAX_ATTEMPTS:
                backoff = 5 * attempt  # 5s, 10s
                _log(f"  attempt {attempt} failed: {e}; retrying in {backoff}s")
                time.sleep(backoff)
            else:
                _log(f"  attempt {attempt} failed (final): {e}")
    assert last_exc is not None
    raise last_exc


def extract_json_object(raw: str) -> dict[str, Any]:
    """
    Find and parse the first top-level JSON object in Claude's response.

    Claude sometimes wraps output in markdown code fences despite the
    prompt — strip those first. We also handle legacy/fallback cases
    where Claude returns just a bare array (old single-section format)
    by wrapping it as { "insights": [...] }.
    """
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    # Try object first (current format).
    obj_start = text.find("{")
    obj_end = text.rfind("}")
    if obj_start != -1 and obj_end > obj_start:
        candidate = text[obj_start : obj_end + 1]
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    # Fallback: bare array of insights.
    arr_start = text.find("[")
    arr_end = text.rfind("]")
    if arr_start != -1 and arr_end > arr_start:
        candidate = text[arr_start : arr_end + 1]
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, list):
                return {"insights": parsed}
        except json.JSONDecodeError as e:
            raise ValueError(
                f"JSON parse failed: {e}. Candidate (first 500 chars):\n{candidate[:500]}"
            ) from e

    raise ValueError(f"Could not locate a JSON object or array in output:\n{raw[:500]}")


def _validate_banner(b: Any, name: str) -> dict[str, str] | None:
    """Banners are optional. If present, they must have tag/title/body strings."""
    if b is None:
        return None
    if not isinstance(b, dict):
        raise ValueError(f"{name}: expected object, got {type(b).__name__}")
    out = {}
    for k in ("tag", "title", "body"):
        v = b.get(k)
        if v is None:
            continue
        if not isinstance(v, str):
            raise ValueError(f"{name}.{k}: expected string")
        out[k] = v.strip()
    if not out:
        return None
    # All three keys must be present together once we decide to render.
    for k in ("tag", "title", "body"):
        out.setdefault(k, "")
    return out


MIN_INSIGHTS = int(os.environ.get("MIN_INSIGHTS", "8"))
MAX_INSIGHTS = int(os.environ.get("MAX_INSIGHTS", "15"))
MIN_BODY_CHARS = int(os.environ.get("MIN_BODY_CHARS", "80"))


def validate_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Reject anything that looks degenerate so retry kicks in:
    - Insight count outside [MIN_INSIGHTS..MAX_INSIGHTS]
    - Missing/empty required fields
    - Body shorter than MIN_BODY_CHARS (too terse to be useful)
    - Invalid tone enum
    """
    if not (MIN_INSIGHTS <= len(items) <= MAX_INSIGHTS):
        raise ValueError(
            f"Expected {MIN_INSIGHTS}-{MAX_INSIGHTS} insight cards, got {len(items)}"
        )
    cleaned = []
    for i, it in enumerate(items):
        if not isinstance(it, dict):
            raise ValueError(f"Item {i} is not an object: {it!r}")
        for k in ("tone", "tag", "title", "body"):
            if k not in it or not isinstance(it[k], str) or not it[k].strip():
                raise ValueError(f"Item {i} missing/empty field {k!r}")
        if it["tone"] not in VALID_TONES:
            raise ValueError(f"Item {i} has invalid tone {it['tone']!r}")
        body = it["body"].strip()
        if len(body) < MIN_BODY_CHARS:
            raise ValueError(
                f"Item {i} body too short ({len(body)} < {MIN_BODY_CHARS} chars): {body[:60]!r}"
            )
        cleaned.append({
            "tone": it["tone"],
            "tag": it["tag"].strip(),
            "title": it["title"].strip(),
            "body": body,
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
        obj = extract_json_object(raw)
        items = validate_items(obj.get("insights", []))
        context_banner = _validate_banner(obj.get("context_banner"), "context_banner")
        tab2_narrative = _validate_banner(obj.get("tab2_narrative"), "tab2_narrative")

        # Claude can take 1-4 minutes. The user may have deleted the snapshot
        # or reset its status in the meantime — don't pollute a snapshot they
        # already moved on from.
        if not bq_data.verify_active_for_write(slug):
            _log(f"ABORT {slug}: snapshot was deleted or status changed mid-run; discarding output")
            return 0

        bq_data.update_snapshot_narratives(slug, context_banner, tab2_narrative)
        n = bq_data.insert_insights(slug, items)
        bq_data.mark_succeeded(slug)
        _log(
            f"OK: {n} insights + "
            f"{'context_banner' if context_banner else 'no-ctx'} + "
            f"{'tab2_narrative' if tab2_narrative else 'no-t2'} for {slug}"
        )
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
