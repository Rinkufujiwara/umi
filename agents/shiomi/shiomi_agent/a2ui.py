"""The question card Shiomi sends when it asks back, as A2UI v0.9 messages (basic catalog).

The agent never writes HTML: it only fills in the question, the choices and why it is unsure. Umi's browser draws
these few known components (Column, Row, Text, ChoicePicker, DateTimeInput, TextField, Button) with its own parts
and ignores anything else.
"""
from __future__ import annotations

A2UI_VERSION = "v0.9"
CATALOG = "https://a2ui.org/specification/v0_9/basic_catalog.json"
MIME = "application/json+a2ui"
EXTENSION = "https://a2ui.org/a2a-extension/a2ui/v0.9"

TEXT = {
    "en": {
        "who": "Shiomi · not sure how heavy this is", "for": "It is for", "due": "Deadline",
        "none": "None", "today": "Today", "week": "This week", "date": "Pick a date…",
        "note": "Anything else (optional)", "hint": "e.g. slides for Monday's meeting",
        "skip": "Let Shiomi guess", "send": "Answer",
        "purposes": ["Class or exam", "Work", "Personal", "Other"],
    },
    "ja": {
        "who": "潮見 · 重さが分かりません", "for": "何のため", "due": "期限",
        "none": "なし", "today": "今日", "week": "今週", "date": "日付を選ぶ…",
        "note": "ほかに一言（任意）", "hint": "例：月曜の会議のスライド",
        "skip": "潮見に任せる", "send": "答える",
        "purposes": ["授業・試験", "仕事", "自分のこと", "その他"],
    },
}


def question_messages(*, surface_id: str, task_id: str, title: str, question: str, why_unsure: str,
                      purposes: list[str] | None, lang: str) -> list[dict]:
    t = TEXT["ja" if lang == "ja" else "en"]
    picks = [p.strip()[:24] for p in (purposes or []) if p and p.strip()][:4] or t["purposes"]
    if t["purposes"][-1] not in picks and len(picks) < 4:
        picks.append(t["purposes"][-1])
    m = lambda body: {"version": A2UI_VERSION, **body}  # noqa: E731
    text = lambda cid, s, variant="body": {"id": cid, "component": "Text", "text": s, "variant": variant}  # noqa: E731
    return [
        m({"createSurface": {"surfaceId": surface_id, "catalogId": CATALOG}}),
        m({"updateComponents": {"surfaceId": surface_id, "components": [
            {"id": "root", "component": "Column",
             "children": ["who", "title", "sub", "for", "due", "date", "note", "actions"]},
            text("who", t["who"], "caption"),
            text("title", question[:120], "h3"),
            text("sub", why_unsure[:160]),
            {"id": "for", "component": "ChoicePicker", "label": t["for"], "variant": "mutuallyExclusive",
             "options": [{"label": p, "value": p} for p in picks], "value": {"path": "/answer/for"}},
            {"id": "due", "component": "ChoicePicker", "label": t["due"], "variant": "mutuallyExclusive",
             "options": [{"label": t[k], "value": k} for k in ("none", "today", "week", "date")],
             "value": {"path": "/answer/deadline"}},
            {"id": "date", "component": "DateTimeInput", "enableDate": True, "enableTime": False,
             "value": {"path": "/answer/date"}},
            {"id": "note", "component": "TextField", "label": t["note"], "placeholder": t["hint"],
             "value": {"path": "/answer/note"}},
            {"id": "actions", "component": "Row", "children": ["skip", "send"]},
            {"id": "skip", "component": "Button", "child": "skip_t", "variant": "borderless",
             "action": {"event": {"name": "skip"}}},
            text("skip_t", t["skip"]),
            {"id": "send", "component": "Button", "child": "send_t", "variant": "primary",
             "action": {"event": {"name": "answer", "context": {"answer": {"path": "/answer"}}}}},
            text("send_t", t["send"]),
        ]}}),
        m({"updateDataModel": {"surfaceId": surface_id, "path": "/", "value": {
            "task": {"id": task_id, "title": title},
            "answer": {"for": "", "deadline": "none", "date": "", "note": ""},
        }}}),
    ]
