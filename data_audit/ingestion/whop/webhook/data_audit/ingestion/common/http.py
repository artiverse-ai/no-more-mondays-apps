"""Tiny HTTP client with retries on 429/5xx — used by every platform client."""

from __future__ import annotations

import time
from typing import Any

import requests


class HttpClient:
    """GET-focused REST client with exponential backoff and Retry-After
    handling. Each platform module wraps this and adds its own auth header
    and base URL."""

    def __init__(self, base_url: str, default_headers: dict[str, str] | None = None,
                 timeout: int = 60):
        self.base_url = base_url.rstrip("/")
        self.default_headers = default_headers or {}
        self.timeout = timeout
        self._session = requests.Session()

    def get(self, path: str, params: dict[str, Any] | None = None,
            headers: dict[str, str] | None = None,
            max_retries: int = 5) -> dict[str, Any]:
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        h = {**self.default_headers, **(headers or {})}
        for attempt in range(max_retries):
            resp = self._session.get(url, params=params, headers=h, timeout=self.timeout)
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", "5"))
                time.sleep(min(wait, 60))
                continue
            if resp.status_code >= 500:
                time.sleep(2 ** attempt)
                continue
            if resp.status_code >= 400:
                raise RuntimeError(
                    f"GET {url} failed [{resp.status_code}]: {resp.text}"
                )
            return resp.json()
        raise RuntimeError(f"GET {url} exhausted retries")

    def post(self, path: str, json_body: dict[str, Any] | None = None,
             data: dict[str, Any] | None = None,
             headers: dict[str, str] | None = None,
             max_retries: int = 5) -> dict[str, Any]:
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        h = {**self.default_headers, **(headers or {})}
        for attempt in range(max_retries):
            resp = self._session.post(url, json=json_body, data=data, headers=h,
                                      timeout=self.timeout)
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", "5"))
                time.sleep(min(wait, 60))
                continue
            if resp.status_code >= 500:
                time.sleep(2 ** attempt)
                continue
            if resp.status_code >= 400:
                raise RuntimeError(
                    f"POST {url} failed [{resp.status_code}]: {resp.text}"
                )
            return resp.json()
        raise RuntimeError(f"POST {url} exhausted retries")
