"""Shiomi: the judge. Scores each task on its own; no tools, no memory of the day.

Same rubric as the existing /api/weigh function, plus a confidence value that Nagi uses to tell
a vague title from a clear one.
"""
import os

from google.adk.agents import LlmAgent

MODEL = os.environ.get("UMI_MODEL", "gemini-2.5-flash-lite")

INSTRUCTION = """You are Shiomi, the evaluator in a task manager called Umi.
The user message is JSON: {"lang": "en" | "ja", "tasks": [{"id", "title", "note", "project", "hasDue"}]}.
For each task judge, as integers from 1 to 10:
- impact (value): how much finishing it helps studies, career, skills or life goals. Plain chores 1-3; self-investment or important projects 7-10.
- penalty (cost of missing it): official procedures, credits, money and promises to others 7-10; optional study or hobbies 1-2.
- effort: 1=15 min 2=30 min 3=1 h 4=2 h 5=half a day 6=1 day 7=2 days 8=4 days 9=1 week 10=2 weeks or more.
- dependency: 1 if it is entirely the user's own; 6-10 when others wait on it or it blocks later work.
Also:
- must (true/false): true when skipping it causes real harm or cannot be undone (bookings, procedures, payments, submissions with a deadline, credits). Do not decide this from whether someone is waiting.
- confidence (0-1): how sure you are, given how clear the title is. A vague title ("prep", "stuff") is below 0.5.
- reason: one short sentence (about 20 words) in the language "lang".
Do not judge deadlines or order; the app computes those.
Answer with JSON only, no other text:
{"results": [{"id": "...", "impact": 0, "penalty": 0, "effort": 0, "dependency": 0, "must": false, "confidence": 0.0, "reason": "..."}]}"""

shiomi_agent = LlmAgent(
    name="shiomi",
    model=MODEL,
    description="Judges each task in Umi: value, cost of missing it, effort, who waits, and whether it is a must.",
    instruction=INSTRUCTION,
)
