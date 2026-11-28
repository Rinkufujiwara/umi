"""Keeping a question open while Cloud Run sleeps.

When Shiomi asks back, the A2A task waits in input-required until the user answers, which may be minutes later on
another instance (or after a scale-to-zero). Two things must survive: the A2A task, and the ADK session that holds
the paused ask_user call. PendingTaskStore keeps both in memory as usual and, only for tasks in input-required,
also writes them to Umi's D1 through /api/memory/pending (as the signed-in user). On a miss it reads them back.
"""
from __future__ import annotations

import logging

from a2a.server.context import ServerCallContext
from a2a.server.tasks import InMemoryTaskStore, TaskStore
from a2a.types.a2a_pb2 import ListTasksRequest, ListTasksResponse, Task
from google.adk.a2a import _compat
from google.adk.sessions import InMemorySessionService, Session
from google.protobuf.json_format import MessageToDict, ParseDict

from . import memory

log = logging.getLogger("shiomi.store")
DONE = {_compat.TS_COMPLETED, _compat.TS_FAILED, _compat.TS_CANCELED, _compat.TS_REJECTED}


class PendingTaskStore(TaskStore):
    def __init__(self, sessions: InMemorySessionService, app_name: str):
        self._mem = InMemoryTaskStore()
        self._sessions = sessions
        self._app = app_name
        self._remote: set[str] = set()  # tasks with a row in D1
        self._missing: set[str] = set()  # ids already looked up in D1 and not there (new tasks)

    # ---- the ADK session that belongs to a context (session id = A2A context id)
    def _dump_session(self, context_id: str) -> list[dict]:
        out = []
        for user_id, by_id in self._sessions.sessions.get(self._app, {}).items():
            s = by_id.get(context_id)
            if s is not None:
                out.append({"user_id": user_id, "session": s.model_dump(mode="json")})
        return out

    def _load_session(self, dumped: list[dict]) -> None:
        for item in dumped or []:
            s = Session.model_validate(item["session"])
            self._sessions.sessions.setdefault(self._app, {}).setdefault(item["user_id"], {})[s.id] = s

    # ---- TaskStore
    async def save(self, task: Task, context: ServerCallContext) -> None:
        await self._mem.save(task, context)
        self._missing.discard(task.id)
        state = task.status.state
        try:
            if state == _compat.TS_INPUT_REQUIRED and task.id not in self._remote:
                body = {"task": MessageToDict(task), "sessions": self._dump_session(task.context_id)}
                await memory.call("PUT", f"/pending/{task.id}", json={"context_id": task.context_id, "body": body})
                self._remote.add(task.id)
            elif state in DONE and task.id in self._remote:
                await memory.call("DELETE", f"/pending/{task.id}")
                self._remote.discard(task.id)
        except Exception:  # the answer can still arrive while this instance is up
            log.exception("could not persist task %s", task.id)

    async def get(self, task_id: str, context: ServerCallContext) -> Task | None:
        task = await self._mem.get(task_id, context)
        if task is not None or task_id in self._missing:
            return task
        try:
            row = await memory.call("GET", f"/pending/{task_id}")
        except Exception:
            log.exception("could not read pending task %s", task_id)
            return None
        if not row:
            self._missing.add(task_id)
            return None
        task = ParseDict(row["body"]["task"], Task())
        self._load_session(row["body"].get("sessions"))
        self._remote.add(task.id)
        await self._mem.save(task, context)
        log.info("resumed task %s from D1", task_id)
        return task

    async def list(self, params: ListTasksRequest, context: ServerCallContext) -> ListTasksResponse:
        return await self._mem.list(params, context)

    async def delete(self, task_id: str, context: ServerCallContext) -> None:
        await self._mem.delete(task_id, context)
        if task_id in self._remote:
            try:
                await memory.call("DELETE", f"/pending/{task_id}")
            finally:
                self._remote.discard(task_id)
