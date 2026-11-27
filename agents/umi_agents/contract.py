"""The handoff contract between Shiomi and Nagi (docs/nagi-agent-design.md §4–5).

ShiomiReport: what the app (and Shiomi) know about today's open tasks.
NagiPlan:     what Nagi proposes. The app checks it again; nothing here trusts the model blindly.
"""
from __future__ import annotations

import json
import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, ValidationError

Source = Literal["you", "ai", "rule"]


class Judgment(BaseModel):
    impact: int = Field(ge=1, le=10)
    penalty: int = Field(ge=1, le=10)
    effort: int = Field(ge=1, le=10)
    dependency: int = Field(ge=1, le=10)
    must: bool
    source: dict[str, Source] = Field(default_factory=dict)  # who decided each value
    reason: str = ""
    confidence: float = Field(default=0.5, ge=0, le=1)


class DiveRecord(BaseModel):
    at: str
    min: int


class ReportTask(BaseModel):
    id: str
    title: str
    section: Literal["surface", "shallows", "depths"] = "surface"
    due: Optional[str] = None
    time: Optional[str] = None
    estMin: int = 60
    slackDays: Optional[float] = None
    order: float = 0
    dives: list[DiveRecord] = Field(default_factory=list)
    judgment: Judgment


class ShiomiReport(BaseModel):
    version: int = 1
    generatedAt: str
    timezone: str = "UTC"
    lang: Literal["en", "ja"] = "en"
    dayBudgetMin: int = 300
    usedTodayMin: int = 0
    tasks: list[ReportTask]


class Keep(BaseModel):
    id: str
    why: str = ""


class Suggestion(BaseModel):
    id: str
    action: Literal["tomorrow", "lighter", "later", "dive"]
    minutes: Optional[int] = None
    why: str = ""


class NagiPlan(BaseModel):
    version: int = 1
    keep: list[Keep] = Field(default_factory=list, max_length=3)
    suggest: list[Suggestion] = Field(default_factory=list)
    message: str = ""
    validUntil: Optional[str] = None


def extract_json(text: str) -> Optional[dict]:
    """Pull the first JSON object out of a model answer (tolerates ```json fences and stray text)."""
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    raw = m.group(1) if m else text[text.find("{"): text.rfind("}") + 1]
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return None


def parse_plan(text: str, report: ShiomiReport) -> Optional[NagiPlan]:
    """A plan only counts if it parses and every id it names is one of the report's open tasks."""
    data = extract_json(text)
    if not data:
        return None
    try:
        plan = NagiPlan.model_validate(data)
    except ValidationError:
        return None
    ids = {t.id for t in report.tasks}
    plan.keep = [k for k in plan.keep if k.id in ids][:3]
    plan.suggest = [s for s in plan.suggest if s.id in ids]
    return plan if plan.keep else None
