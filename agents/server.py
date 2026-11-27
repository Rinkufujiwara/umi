"""Umi agents service (Cloud Run).

Routes
  /shiomi/...   Shiomi as an A2A agent (agent card at /shiomi/.well-known/agent-card.json)
  /nagi/...     Nagi as an A2A agent   (agent card at /nagi/.well-known/agent-card.json)
  POST /plan    the app's entry point: ShiomiReport in, NagiPlan out (Shiomi → Nagi over A2A)
  GET  /health

Every route except the agent cards and /health needs the header X-Umi-Secret (NAGI_SECRET), which only the
Vercel function /api/nagi knows. That keeps the model calls from being used by anyone else.

Environment: GOOGLE_API_KEY (Gemini), NAGI_SECRET, PUBLIC_URL (e.g. https://umi-agents-xxxx.a.run.app), PORT.
"""
import logging
import os
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from google.adk.a2a.utils.agent_to_a2a import to_a2a
from pydantic import ValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from umi_agents.contract import ShiomiReport
from umi_agents.nagi import nagi_agent
from umi_agents.orchestrator import plan
from umi_agents.shiomi import shiomi_agent

log = logging.getLogger("umi")
PORT = int(os.environ.get("PORT", "8080"))
PUBLIC_URL = os.environ.get("PUBLIC_URL", f"http://localhost:{PORT}").rstrip("/")
SECRET = os.environ.get("NAGI_SECRET", "")
_u = urlparse(PUBLIC_URL)
HOST, PROTO = _u.hostname or "localhost", _u.scheme or "http"
CARD_PORT = _u.port or (443 if PROTO == "https" else 80)

shiomi_app = to_a2a(shiomi_agent, host=HOST, port=CARD_PORT, protocol=PROTO, rpc_path="shiomi")


async def plan_endpoint(request: Request):
    try:
        report = ShiomiReport.model_validate((await request.json()).get("report"))
    except (ValidationError, ValueError, AttributeError) as e:
        return JSONResponse({"error": "bad report", "detail": str(e)[:300]}, status_code=400)
    try:
        result, trace = await plan(report, PUBLIC_URL, SECRET)  # same origin as the agent cards (A2A requires it)
    except Exception as e:  # the app falls back to its formula on any error
        log.exception("plan failed")
        return JSONResponse({"error": "plan failed", "detail": str(e)[:300]}, status_code=502)
    if not result:
        return JSONResponse({"error": "no usable plan", "trace": trace}, status_code=502)
    return JSONResponse({"plan": result.model_dump(), "trace": trace})


async def health(_: Request):
    return JSONResponse({"ok": True})


@asynccontextmanager
async def lifespan(app):
    # attach Shiomi's A2A routes to this same app, then the app's own routes
    async with shiomi_app.router.lifespan_context(app):
        app.router.routes.append(Route("/plan", plan_endpoint, methods=["POST"]))
        app.router.routes.append(Route("/health", health, methods=["GET"]))
        yield


class SecretCheck(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        p = request.url.path
        open_path = p == "/health" or p.endswith("/.well-known/agent-card.json") or p.endswith("/.well-known/agent.json")
        if SECRET and not open_path and request.headers.get("X-Umi-Secret") != SECRET:
            return JSONResponse({"error": "forbidden"}, status_code=403)
        return await call_next(request)


app = to_a2a(nagi_agent, host=HOST, port=CARD_PORT, protocol=PROTO, rpc_path="nagi", lifespan=lifespan)
app.add_middleware(SecretCheck)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
