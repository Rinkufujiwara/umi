"""End-to-end check of Shiomi's A2A flow without Gemini or the network.

A scripted model stands in for Gemini, a dict stands in for /api/memory, and the sign-in check is stubbed.
It runs: ask → input-required with an A2UI card → the instance "restarts" (memory wiped) → the answer is sent with
the same taskId/contextId → the task is read back from the pending store → Shiomi finishes, and the answer is
recorded in clarifications.

  cd agents/shiomi && python -m pytest -q tests     (or: python tests/test_flow.py)
"""
from __future__ import annotations

import json
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("ALLOWED_EMAILS", "tester@example.com")

from google.adk.models.base_llm import BaseLlm  # noqa: E402
from google.adk.models.llm_response import LlmResponse  # noqa: E402
from google.genai import types  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from shiomi_agent import memory  # noqa: E402

# ---------------------------------------------------------------- fakes
DB: dict = {"pending": {}, "clarifications": [], "calls": []}


async def fake_call(method, path, *, params=None, json=None):
    assert memory.TOKEN.get() == "good-token", "the user's token must reach the memory calls"
    DB["calls"].append((method, path))
    if path == "/recall":
        return {"corrections": [{"title": "prep slides", "field": "effort", "shiomi": "3", "user": "5"}], "clarifications": []}
    if path == "/effort-bias":
        return {"samples": 4, "medianActualOverEstimate": 1.5}
    if path.startswith("/pending/"):
        tid = path.split("/")[-1]
        if method == "PUT":
            DB["pending"][tid] = json
            return {"ok": True}
        if method == "GET":
            row = DB["pending"].get(tid)
            return {"task_id": tid, "context_id": row["context_id"], "body": row["body"]} if row else None
        if method == "DELETE":
            DB["pending"].pop(tid, None)
            return {"ok": True}
    if path == "/clarifications":
        DB["clarifications"].append(json)
        return {"ok": True}
    raise AssertionError(f"unexpected memory call {method} {path}")


async def fake_who_is(token):
    return "tester@example.com" if token == "good-token" else None


class Scripted(BaseLlm):
    model: str = "scripted"

    async def generate_content_async(self, llm_request, stream=False):
        responses = [p.function_response for c in llm_request.contents for p in (c.parts or []) if p.function_response]
        names = [r.name for r in responses]
        if "ask_user" in names:
            ans = [r for r in responses if r.name == "ask_user"][-1].response
            out = {"results": [{"id": "t1", "impact": 6, "penalty": 5, "effort": 4, "dependency": 6, "must": False,
                                "confidence": 0.85, "reason": "work slides", "memory": f"answer: {ans.get('for')}"}]}
            yield LlmResponse(content=types.Content(role="model", parts=[types.Part(text=json.dumps(out))]))
        elif "recall_corrections" in names:
            yield LlmResponse(content=types.Content(role="model", parts=[types.Part(function_call=types.FunctionCall(
                id="call-ask", name="ask_user", args={"task_id": "t1", "title": "prep", "question": 'What is "prep" for?',
                                                      "purposes": ["Class or exam", "Work"], "why_unsure": "Too short.", "lang": "en"}))]))
        else:
            yield LlmResponse(content=types.Content(role="model", parts=[
                types.Part(function_call=types.FunctionCall(id="c1", name="recall_corrections", args={"title": "prep"})),
                types.Part(function_call=types.FunctionCall(id="c2", name="effort_bias", args={}))]))


def rpc(client, method, params):
    r = client.post("/", headers={"Authorization": "Bearer good-token", "A2A-Version": "1.0"},
                    json={"jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": method, "params": params})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "error" not in body, body
    return body["result"]


def test_ask_back_and_resume():
    memory.call = fake_call
    main.who_is = fake_who_is
    main.shiomi_agent.model = Scripted()

    with TestClient(main.app) as client:
        card = client.get("/.well-known/agent-card.json").json()
        uris = [e["uri"] for e in card["capabilities"]["extensions"]]
        assert main.a2ui.EXTENSION in uris and main.ASK_BACK_EXTENSION in uris
        assert client.post("/", json={}).status_code == 401  # no token, no entry

        ctx = str(uuid.uuid4())
        first = rpc(client, "SendMessage", {"message": {
            "messageId": str(uuid.uuid4()), "role": "ROLE_USER", "contextId": ctx,
            "parts": [{"text": json.dumps({"lang": "en", "askAllowed": True, "tasks": [{"id": "t1", "title": "prep"}]})}]}})
        task = first["task"]
        assert task["status"]["state"] == "TASK_STATE_INPUT_REQUIRED", task["status"]
        parts = task["status"]["message"]["parts"]
        call = next(p["data"] for p in parts if isinstance(p.get("data"), dict) and p["data"].get("name") == "ask_user")
        cards = [p["data"] for p in parts if (p.get("metadata") or {}).get("mimeType") == main.a2ui.MIME]
        assert [list(m)[1] for m in cards] == ["createSurface", "updateComponents", "updateDataModel"], cards
        assert task["id"] in DB["pending"], "an input-required task must be saved"
        print("call part:", json.dumps(next(p for p in parts if (p.get("data") or {}).get("name") == "ask_user")))

    # a new instance: nothing in memory, only the pending row in "D1"
    main.task_store._mem = type(main.task_store._mem)()
    main.task_store._remote.clear(); main.task_store._missing.clear()
    main.sessions.sessions.clear()

    with TestClient(main.app) as client:
        meta_key = next(k for k in next(p for p in parts if (p.get("data") or {}).get("name") == "ask_user")["metadata"] if k.endswith("type"))
        done = rpc(client, "SendMessage", {"message": {
            "messageId": str(uuid.uuid4()), "role": "ROLE_USER", "contextId": ctx, "taskId": task["id"],
            "parts": [{"data": {"id": call["id"], "name": "ask_user", "response": {"for": "Work", "deadline": "none"}},
                       "metadata": {meta_key: "function_response"}}]}})
        t2 = done["task"]
        assert t2["status"]["state"] == "TASK_STATE_COMPLETED", t2["status"]
        text = "".join(p.get("text", "") for a in t2.get("artifacts", []) for p in a["parts"])
        assert '"confidence": 0.85' in text, text
        assert DB["clarifications"] and DB["clarifications"][0]["answer"]["for"] == "Work"
        assert task["id"] not in DB["pending"], "the pending row is removed once the task is done"
    print("ok:", DB["calls"])


if __name__ == "__main__":
    test_ask_back_and_resume()
