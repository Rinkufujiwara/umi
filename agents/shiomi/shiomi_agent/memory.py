"""Shiomi's memory lives in Cloudflare D1, behind Umi's /api/memory. Shiomi cannot reach D1 directly, so every
call forwards the signed-in user's Firebase ID token; /api/memory takes the uid from that token, so each person
only reads and writes their own rows and no extra secret is needed.

The token of the request being handled sits in a context variable that the auth middleware sets.
"""
from __future__ import annotations

import contextvars
import os
from typing import Any, Optional

import httpx

TOKEN: contextvars.ContextVar[str] = contextvars.ContextVar("umi_token", default="")
MEMORY_URL = os.environ.get("MEMORY_URL", "https://umi-lake.pages.dev/api/memory").rstrip("/")

_client: Optional[httpx.AsyncClient] = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(8.0, connect=4.0))
    return _client


async def call(method: str, path: str, *, params: dict | None = None, json: Any = None) -> Any:
    """One request to /api/memory as the current user. Returns the JSON body, or None for a 404."""
    token = TOKEN.get()
    if not token:
        raise RuntimeError("no user token for memory")
    r = await client().request(method, f"{MEMORY_URL}{path}", params=params, json=json,
                               headers={"Authorization": f"Bearer {token}"})
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()
