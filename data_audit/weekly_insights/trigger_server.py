#!/usr/bin/env python3
"""
Tiny HTTP listener that lets the Vercel app trigger an insight generation
immediately instead of waiting for the next cron tick.

Auth: shared secret in the X-Trigger-Secret header (env var TRIGGER_SECRET).
Endpoint: POST /trigger — fires the wrapper script and returns 202.

Designed to run as a systemd service. The cron entry is still in place as a
safety net for cases where the VM is unreachable, so this is purely an
accelerator — no correctness depends on it staying up.
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("TRIGGER_PORT", "8080"))
SECRET = os.environ.get("TRIGGER_SECRET", "")
WRAPPER = pathlib.Path(__file__).resolve().with_name("generate_insights_wrapper.sh")


class Handler(BaseHTTPRequestHandler):
    server_version = "weekly-insights-trigger/1"

    def log_message(self, fmt: str, *args) -> None:
        # systemd journal already timestamps. Keep it terse.
        print(f"{self.address_string()} - {fmt % args}", flush=True)

    def _respond(self, code: int, body: dict | None = None) -> None:
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if body is not None:
            self.wfile.write(json.dumps(body).encode())
            self.wfile.write(b"\n")

    def do_GET(self) -> None:
        if self.path == "/health":
            self._respond(200, {"ok": True})
        else:
            self._respond(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path != "/trigger":
            self._respond(404, {"error": "not found"})
            return
        provided = self.headers.get("X-Trigger-Secret", "")
        if not SECRET or provided != SECRET:
            self._respond(401, {"error": "bad secret"})
            return
        if not WRAPPER.is_file():
            self._respond(500, {"error": f"wrapper missing: {WRAPPER}"})
            return
        # Fire-and-forget. The wrapper already uses flock so concurrent
        # invocations are safe — the second one exits with "SKIP".
        subprocess.Popen(
            ["bash", str(WRAPPER)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            close_fds=True,
        )
        self._respond(202, {"ok": True, "queued": True})


def main() -> None:
    if not SECRET:
        print("ERROR: TRIGGER_SECRET env var is empty", flush=True)
        raise SystemExit(2)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"weekly-insights-trigger listening on 0.0.0.0:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
