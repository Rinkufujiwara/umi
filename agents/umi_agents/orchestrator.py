"""The handoff: the app's report goes to Shiomi (over A2A) for any task it has not judged well,
the improved report goes to Nagi (over A2A), and Nagi's answer comes back as a NagiPlan.

Both agents are reached as remote A2A agents, even when they run in the same service, so either one can
be moved to its own service later without changing this code.
"""
import json
import os
import uuid

import httpx
from google.adk.a2a.agent import RemoteA2aAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from .contract import NagiPlan, ShiomiReport, extract_json, parse_plan
from .nagi import default_valid_until

LOW_CONFIDENCE = 0.5


def _client(secret: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(headers={"X-Umi-Secret": secret} if secret else {}, timeout=httpx.Timeout(25.0))


async def ask(card_url: str, name: str, payload: dict, secret: str) -> str:
    """Send one JSON message to a remote A2A agent and return its final text."""
    async with _client(secret) as http:
        agent = RemoteA2aAgent(name=name, agent_card=card_url, httpx_client=http)
        sessions = InMemorySessionService()
        runner = Runner(app_name=f"umi-{name}-client", agent=agent, session_service=sessions)
        session = await sessions.create_session(app_name=runner.app_name, user_id="umi")
        msg = types.Content(role="user", parts=[types.Part(text=json.dumps(payload, ensure_ascii=False))])
        text = ""
        async for event in runner.run_async(user_id="umi", session_id=session.id, new_message=msg):
            if event.content and event.content.parts:
                chunk = "".join(p.text or "" for p in event.content.parts if getattr(p, "text", None))
                if chunk:
                    text = chunk  # keep the latest text; the final event holds the answer
        return text


def needs_judgment(t) -> bool:
    j = t.judgment
    return "you" not in j.source.values() and (j.source.get("impact") == "rule" or j.confidence < LOW_CONFIDENCE)


async def plan(report: ShiomiReport, base_url: str, secret: str = "") -> tuple[NagiPlan | None, dict]:
    """Returns (plan or None, trace). The trace says what each agent did, for logs and the README."""
    trace = {"shiomi": 0, "nagi": False}
    # 1) Shiomi: judge what the report does not know well
    todo = [t for t in report.tasks if needs_judgment(t)][:12]
    if todo:
        answer = await ask(f"{base_url}/shiomi/.well-known/agent-card.json", "shiomi",
                           {"lang": report.lang, "tasks": [{"id": t.id, "title": t.title, "note": "", "project": "", "hasDue": bool(t.due)} for t in todo]},
                           secret)
        data = extract_json(answer) or {}
        by_id = {r.get("id"): r for r in data.get("results", []) if isinstance(r, dict)}
        for t in report.tasks:
            r = by_id.get(t.id)
            if not r:
                continue
            j = t.judgment
            for k in ("impact", "penalty", "effort", "dependency"):
                if j.source.get(k) != "you" and isinstance(r.get(k), int):
                    setattr(j, k, max(1, min(10, r[k]))); j.source[k] = "ai"
            if j.source.get("must") != "you" and isinstance(r.get("must"), bool):
                j.must = r["must"]; j.source["must"] = "ai"
            if isinstance(r.get("confidence"), (int, float)):
                j.confidence = max(0.0, min(1.0, float(r["confidence"])))
            j.reason = str(r.get("reason", j.reason))[:160]
            trace["shiomi"] += 1
    # 2) Nagi: plan from the (improved) report
    answer = await ask(f"{base_url}/nagi/.well-known/agent-card.json", "nagi", report.model_dump(), secret)
    result = parse_plan(answer, report)
    if result:
        result.validUntil = result.validUntil or default_valid_until()
        trace["nagi"] = True
    return result, trace
