"""Shiomi: Umi's judge, as an ADK agent with memory tools and the right to ask back.

Tools
  recall_corrections(title)  how this person corrected Shiomi on similar tasks, and what they answered before
  effort_bias()              how far estimates were from the real Dive minutes
  ask_user(...)              long-running: the A2A task goes to input-required and waits for the user's answer
"""
from __future__ import annotations

import os

from google.adk.agents import LlmAgent
from google.adk.tools import FunctionTool, LongRunningFunctionTool

from . import memory

MODEL = os.environ.get("UMI_MODEL", "gemini-2.5-flash")

INSTRUCTION = """You are Shiomi, the judge in a task manager called Umi. The user message is JSON:
{"lang": "en" | "ja", "askAllowed": true | false, "why": "why you are being asked (from Nagi, the planner)",
 "areas": ["the user's project names"], "tasks": [{"id", "title", "note", "due", "slackDays", "now": {current values and who set them}}]}

For each task, judge as integers from 1 to 10:
- impact (value): how much finishing it helps studies, career, skills or life goals. Plain chores 1-3; self-investment or important projects 7-10.
- penalty (cost of missing it): official procedures, credits, money and promises to others 7-10; optional study or hobbies 1-2.
- effort: 1=15 min 2=30 min 3=1 h 4=2 h 5=half a day 6=1 day 7=2 days 8=4 days 9=1 week 10=2 weeks or more.
- dependency: 1 if it is entirely the user's own; 6-10 when others wait on it or it blocks later work.
- must (true/false): true when skipping it causes real harm or cannot be undone (bookings, procedures, payments,
  submissions with a deadline, credits). Do not decide this from whether someone is waiting.
- confidence (0-1): how sure you are. Below 0.5 when the title is vague and nothing tells you more.

How to work:
1. Call recall_corrections with each task's title (once per task). Call effort_bias once.
   Past corrections are this person's yardstick: if they changed a value on a similar task, follow them.
   If past answers (clarifications) explain a similar title, use them and do not ask again.
   If effort_bias says medianActualOverEstimate is above 1.3, raise effort one step; below 0.7, lower it one step.
2. If one title is too vague to judge at all (for example "prep", "stuff", "準備"), nothing in memory explains it,
   and askAllowed is true, call ask_user for that one task: one short question in "lang", 2-4 likely purposes
   (use the areas when they fit), and why you are unsure. Ask about at most one task, then stop and wait.
   Never ask when askAllowed is false: judge it with a low confidence instead.
3. When ask_user comes back with the user's answer, judge that task with it (confidence 0.8 or more).
   If the answer says "skipped", guess and keep the confidence below 0.5.
4. Finish with JSON only, no other text:
{"results": [{"id": "...", "impact": 1, "penalty": 1, "effort": 1, "dependency": 1, "must": false, "confidence": 0.0,
  "reason": "one short sentence in lang", "memory": "what from memory or the user's answer changed this, in lang, or empty"}]}
Do not judge deadlines or order; the app computes those."""


async def recall_corrections(title: str) -> dict:
    """Look up this user's memory for tasks whose titles share words with `title`.

    Returns {"corrections": [{title, field, shiomi, user}], "clarifications": [{title, question, answer}]}:
    the values the user corrected by hand on similar tasks (what Shiomi said, what the user set), and answers the
    user gave to Shiomi's earlier questions.
    """
    try:
        return await memory.call("GET", "/recall", params={"title": title[:200]}) or {}
    except Exception:  # memory is a help, not a requirement
        return {"error": "memory unavailable"}


async def effort_bias() -> dict:
    """How long this user's tasks really took against the estimates, from finished focus sessions (Dives).

    medianActualOverEstimate 1.5 means things take one and a half times the estimate.
    """
    try:
        return await memory.call("GET", "/effort-bias") or {}
    except Exception:
        return {"error": "memory unavailable"}


def ask_user(task_id: str, title: str, question: str, purposes: list[str], why_unsure: str, lang: str) -> None:
    """Ask the user one short question about a task whose title is too vague to judge.

    Args:
      task_id: the task's id.
      title: the task's title, as given.
      question: one short question, e.g. 'What is "prep" for?'.
      purposes: 2-4 short likely purposes the user can pick from.
      why_unsure: one short sentence on why the title is not enough.
      lang: "en" or "ja", the input's lang.

    The user answers later with {"for": ..., "deadline": "none"|"today"|"week"|"date", "date": ..., "note": ...},
    or {"skipped": true} when they let Shiomi guess.
    """
    return None  # nothing yet: the run pauses here and the A2A task waits in input-required


shiomi_agent = LlmAgent(
    name="shiomi",
    model=MODEL,
    description=("Judges Umi's tasks (impact, penalty, effort, dependency, must, confidence) from this user's own "
                 "memory of corrections and real Dive times. When a title is too vague it asks back: the A2A task "
                 "goes to input-required with an A2UI question card, and resumes with the user's answer."),
    instruction=INSTRUCTION,
    tools=[FunctionTool(recall_corrections), FunctionTool(effort_bias), LongRunningFunctionTool(ask_user)],
)
