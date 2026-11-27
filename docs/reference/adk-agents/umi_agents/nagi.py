"""Nagi: the planner. Reads Shiomi's report, looks things up with its tools, and proposes the three tasks
to keep afloat now, with a reason for each. It only proposes; the app checks the plan and the user decides.
"""
import json
import os
from datetime import datetime, timedelta, timezone

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.tools import ToolContext

from .contract import ShiomiReport, extract_json

MODEL = os.environ.get("UMI_MODEL", "gemini-2.5-flash-lite")


# ---------------------------------------------------------------- reading the handoff into the session
def load_report(callback_context: CallbackContext):
    """Before Nagi thinks, parse the ShiomiReport from the incoming message into session state."""
    content = callback_context.user_content
    text = "".join(p.text or "" for p in (content.parts if content else []) if getattr(p, "text", None))
    data = extract_json(text)
    if data and "tasks" in data:
        callback_context.state["report"] = data
    return None


def _report(tool_context: ToolContext) -> ShiomiReport | None:
    data = tool_context.state.get("report")
    return ShiomiReport.model_validate(data) if data else None


# ---------------------------------------------------------------- tools (read-only)
def get_day_budget(tool_context: ToolContext) -> dict:
    """Minutes the user can work today, minutes already used, and minutes left."""
    r = _report(tool_context)
    if not r:
        return {"error": "no report"}
    planned = sum(t.estMin for t in r.tasks if t.section == "surface")
    return {"budgetMin": r.dayBudgetMin, "usedMin": r.usedTodayMin, "leftMin": max(0, r.dayBudgetMin - r.usedTodayMin),
            "plannedTodayMin": planned}


def get_dive_history(tool_context: ToolContext) -> dict:
    """Recent focus sessions (Dives) per task: when and for how long."""
    r = _report(tool_context)
    if not r:
        return {"error": "no report"}
    return {"dives": [{"id": t.id, "title": t.title, "dives": [d.model_dump() for d in t.dives]} for t in r.tasks if t.dives]}


def get_task(task_id: str, tool_context: ToolContext) -> dict:
    """Everything the report holds about one task (due date, slack, Shiomi's judgment and who set each value)."""
    r = _report(tool_context)
    for t in (r.tasks if r else []):
        if t.id == task_id:
            return t.model_dump()
    return {"error": f"no task {task_id}"}


def get_free_time(tool_context: ToolContext) -> dict:
    """Free blocks in the user's calendar today. The calendar is not connected yet (phase 3)."""
    return {"connected": False, "note": "Calendar not connected; plan from the day budget only."}


INSTRUCTION = """You are Nagi, the planner in a task manager called Umi. The app shows tasks as buoys on a lake;
"Nagi mode" keeps only three tasks afloat so the user can focus.

The user message is a JSON ShiomiReport: today's open tasks with due dates, slack in days (days left minus days of work),
the app's own order score, and Shiomi's judgment of each task (impact, penalty, effort, dependency, must, a reason,
a confidence, and "source" saying who set each value: "you" = the user, "ai" = Shiomi, "rule" = a keyword guess).

Plan what to keep afloat now:
1. Call get_day_budget. Call get_free_time. Call get_task or get_dive_history only if you need them.
2. Choose up to three tasks from section "surface" to keep, in the order to do them.
   - Values with source "you" are fixed: never argue with them.
   - Overdue must tasks always stay.
   - Prefer little slack, must, high penalty, someone waiting; fit the minutes left.
   - When Shiomi's confidence is low, rely more on the due date and the app's order.
3. Optionally suggest for other tasks: "tomorrow", "lighter" (lower its weight), "later" (+3 days), or "dive"
   (a 25 or 50 minute focus session, only for a kept task). Suggest little; the user decides.
4. Write one calm sentence for the day as "message". No pressure, no exclamation marks.
Write every "why" and the message in the report's "lang" ("en" English, "ja" Japanese), one short sentence each.

Answer with JSON only:
{"version": 1, "keep": [{"id": "...", "why": "..."}], "suggest": [{"id": "...", "action": "tomorrow", "minutes": null, "why": "..."}],
 "message": "...", "validUntil": "<ISO time about 3 hours from now>"}"""

nagi_agent = LlmAgent(
    name="nagi",
    model=MODEL,
    description="Plans Umi's Nagi mode: picks the three tasks to keep afloat now, with reasons, from Shiomi's report.",
    instruction=INSTRUCTION,
    tools=[get_day_budget, get_free_time, get_task, get_dive_history],
    before_agent_callback=load_report,
)


def default_valid_until(hours: float = 3) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()
