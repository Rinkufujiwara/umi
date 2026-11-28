"""Shiomi on Cloud Run: Umi's judge as an ADK agent served over A2A (JSON-RPC, protocol 1.0 with 0.3 compatibility).

  GET  /.well-known/agent-card.json   the agent card (public)
  POST /                              A2A JSON-RPC (SendMessage / message/send, GetTask, ...)
  GET  /health

Who may call: every request except the card and /health needs "Authorization: Bearer <Firebase ID token>" of an
account in ALLOWED_EMAILS. The same token is forwarded to Umi's /api/memory, so Shiomi only sees that user's memory.

Environment
  GOOGLE_API_KEY   Gemini key, from Secret Manager (never in the repo)
  ALLOWED_EMAILS   comma-separated Google accounts
  PUBLIC_URL       this service's https URL (goes into the agent card)
  MEMORY_URL       default https://umi-lake.pages.dev/api/memory
  UMI_MODEL        default gemini-2.5-flash
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from urllib.parse import urlparse

import httpx
from a2a.types.a2a_pb2 import AgentExtension
from google.adk.a2a import _compat
from google.adk.a2a.converters.part_converter import convert_genai_part_to_a2a_part
from google.adk.a2a.executor.a2a_agent_executor import A2aAgentExecutor
from google.adk.a2a.executor.config import A2aAgentExecutorConfig, ExecuteInterceptor
from google.adk.a2a.utils.agent_card_builder import AgentCardBuilder
from google.adk.a2a.utils.agent_to_a2a import to_a2a
from google.adk.artifacts import InMemoryArtifactService
from google.adk.memory import InMemoryMemoryService
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from shiomi_agent import a2ui, memory
from shiomi_agent.agent import shiomi_agent
from shiomi_agent.store import PendingTaskStore

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("shiomi")

PORT = int(os.environ.get("PORT", "8080"))
PUBLIC_URL = os.environ.get("PUBLIC_URL", f"http://localhost:{PORT}").rstrip("/")
ALLOWED = {e.strip().lower() for e in os.environ.get("ALLOWED_EMAILS", "").split(",") if e.strip()}
FIREBASE_WEB_KEY = os.environ.get("FIREBASE_WEB_KEY", "AIzaSyAWZAOK24ufgVlRy4aZb6nE-8rv_HIt8jA")  # public web key
ASK_BACK_EXTENSION = "https://umi-lake.pages.dev/a2a/ask-back/v1"
APP = "shiomi"


# ---------------------------------------------------------------- sign-in check (Firebase ID token → allow-list)
_seen: dict[str, tuple[float, str]] = {}


async def who_is(token: str) -> str | None:
    key = hashlib.sha256(token.encode()).hexdigest()
    hit = _seen.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    r = await memory.client().post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_WEB_KEY}", json={"idToken": token})
    if r.status_code != 200:
        return None
    users = r.json().get("users") or []
    u = users[0] if users else {}
    email = (u.get("email") or "").lower()
    if not email or u.get("emailVerified") is False:
        return None
    _seen[key] = (time.time() + 300, email)
    return email


class FirebaseAuth:
    """Pure ASGI middleware, so the token it puts in memory.TOKEN is seen by the agent's tools."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope.get("path", "")
        if path == "/health" or path.endswith("/agent-card.json") or path.endswith("/agent.json"):
            return await self.app(scope, receive, send)
        auth = dict(scope.get("headers") or []).get(b"authorization", b"").decode()
        token = auth[7:] if auth.startswith("Bearer ") else ""
        if not ALLOWED:
            return await JSONResponse({"error": "not configured"}, 503)(scope, receive, send)
        email = await who_is(token) if token else None
        if not email:
            return await JSONResponse({"error": "sign in first"}, 401)(scope, receive, send)
        if email not in ALLOWED:
            return await JSONResponse({"error": "not allowed"}, 403)(scope, receive, send)
        reset = memory.TOKEN.set(token)
        try:
            await self.app(scope, receive, send)
        finally:
            memory.TOKEN.reset(reset)


# ---------------------------------------------------------------- ask-back: the A2UI card rides with the paused call
def to_a2a_part(part):
    out = convert_genai_part_to_a2a_part(part)
    fc = part.function_call
    if not fc or fc.name != "ask_user":
        return out
    a = dict(fc.args or {})
    msgs = a2ui.question_messages(
        surface_id=f"ask-{fc.id}", task_id=str(a.get("task_id", "")), title=str(a.get("title", "")),
        question=str(a.get("question", "")), why_unsure=str(a.get("why_unsure", "")),
        purposes=list(a.get("purposes") or []), lang=str(a.get("lang", "en")))
    extra = [_compat.make_data_part(data=m, metadata={"mimeType": a2ui.MIME}) for m in msgs]
    base = out if isinstance(out, list) else ([out] if out else [])
    return base + extra


def _ask_call(task) -> dict | None:
    """The paused ask_user call in a task's status message, if any."""
    msg = task.status.message if task and task.HasField("status") else None
    for p in (msg.parts if msg else []):
        if _compat.is_data_part(p):
            d = _compat.data_part_dict(p)
            if d.get("name") == "ask_user" and "args" in d:
                return d
    return None


async def record_answer(context):
    """Before the run resumes: write the user's answer to Shiomi's memory (clarifications)."""
    call = _ask_call(context.current_task)
    if not call or not context.message:
        return context
    for p in context.message.parts:
        if not _compat.is_data_part(p):
            continue
        d = _compat.data_part_dict(p)
        if d.get("name") != "ask_user":
            continue
        answer = (d.get("response") or {})
        if answer.get("skipped"):
            break
        a = call.get("args") or {}
        try:
            await memory.call("POST", "/clarifications", json={
                "task_id": a.get("task_id", ""), "title": a.get("title", ""), "question": a.get("question", ""),
                "answer": answer})
        except Exception:
            log.exception("could not record the answer")
        break
    return context


# ---------------------------------------------------------------- the app
sessions = InMemorySessionService()
runner = Runner(app_name=APP, agent=shiomi_agent, session_service=sessions,
                artifact_service=InMemoryArtifactService(), memory_service=InMemoryMemoryService())
config = A2aAgentExecutorConfig(gen_ai_part_converter=to_a2a_part,
                                execute_interceptors=[ExecuteInterceptor(before_agent=record_answer)])


def build_card():
    u = urlparse(PUBLIC_URL)
    card = asyncio.run(AgentCardBuilder(agent=shiomi_agent, rpc_url=f"{PUBLIC_URL}/", agent_version="2.0.0").build())
    card.capabilities.extensions.append(AgentExtension(
        uri=a2ui.EXTENSION, required=False,
        description=("While a task is input-required, its status message carries A2UI v0.9 messages "
                     f"(data parts with mimeType {a2ui.MIME}, basic catalog) describing the question card.")))
    card.capabilities.extensions.append(AgentExtension(
        uri=ASK_BACK_EXTENSION, required=False,
        description=("Shiomi may answer with state input-required (a long-running ask_user call) when a title is "
                     "too vague. Resume by sending a function_response data part for ask_user with the same "
                     "taskId and contextId. Send askAllowed: false to forbid questions.")))
    log.info("card for %s", u.netloc)
    return card


task_store = PendingTaskStore(sessions, APP)


async def health(_: Request):
    return JSONResponse({"ok": True, "agent": "shiomi"})

app = to_a2a(shiomi_agent, agent_card=build_card(), task_store=task_store, runner=runner,
             agent_executor_factory=lambda r: A2aAgentExecutor(runner=r, config=config))
app.router.routes.append(Route("/health", health, methods=["GET"]))
app = FirebaseAuth(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
