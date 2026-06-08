"""Whop v5 API client. Auth: Bearer <Company API Key>.

Docs: https://docs.whop.com/developer/api/getting-started
"""

from __future__ import annotations

from typing import Any, Iterator

from ..common import secrets
from ..common.http import HttpClient
from . import config


class WhopClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or secrets.get(
            config.SECRET_API_KEY, env_fallback=config.ENV_API_KEY
        )
        self.http = HttpClient(
            base_url=config.API_BASE,
            default_headers={
                "Authorization": f"Bearer {self.api_key}",
                "Accept": "application/json",
            },
        )

    def paginate(self, path: str, params: dict[str, Any] | None = None,
                 items_key: str = "data", page_size: int = 50) -> Iterator[dict[str, Any]]:
        """Whop v5 uses `?page=N&per=N`. The response wraps records in
        `data` and reports `pagination.total_page` (singular). When we've
        iterated past the last page (or received a short page), stop."""
        params = dict(params or {})
        params.setdefault("per", page_size)
        page = 1
        while True:
            params["page"] = page
            body = self.http.get(path, params=params)
            items = body.get(items_key) or []
            if not items:
                return
            for item in items:
                yield item
            pg = body.get("pagination") or {}
            total = pg.get("total_page") or pg.get("total_pages")
            if total and page >= int(total):
                return
            if len(items) < page_size:
                return
            page += 1
