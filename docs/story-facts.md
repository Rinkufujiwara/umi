# Story facts: Shiomi and Nagi as agents (2026-11-28)

Facts only, for the portfolio's "Read the story". The wording of the story comes from the user, on the portfolio side.
Source brief: `docs/agent-upgrade-brief.md`. Design and decisions: `docs/nagi-agent-design.md` §14.

## Before (commit 682d7bb)

- Shiomi: one Gemini call returning scores as JSON. No tools, no memory.
- Nagi: four function-calling tools. `get_free_time` returned "not connected"; the other three re-read the report it was given.
- A2A: `/api/nagi` always called Shiomi, then Nagi, in a fixed order. Both on Cloudflare, both JavaScript.

## What was built

1. **Memory (Cloudflare D1 `umi-memory`, behind `/api/memory`).** Four tables: `corrections` (hand changes to Shiomi's
   values), `actuals` (real Dive minutes against the estimate), `clarifications` (answers to Shiomi's questions),
   `pending_tasks` (A2A tasks waiting for an answer). Rows are per Firebase uid, taken from the verified token.
   The app records corrections (weight buttons, buoy drag, "lighter") and Dive ends (`memory.js`).
2. **Shiomi rebuilt on Google ADK (Python), on Cloud Run.** Service `umi-shiomi`, europe-west1, min instances 0.
   Served over A2A 1.0 with ADK's `to_a2a()` (google-adk 2.15.1, a2a-sdk 1.3.1). Tools: `recall_corrections(title)`,
   `effort_bias()`, and `ask_user(...)`, a `LongRunningFunctionTool`. Gemini key in Secret Manager.
3. **Asking back.** When a title is too vague, `ask_user` pauses the run. ADK reports the A2A task as `input-required`.
   Shiomi attaches the question as A2UI v0.9 messages (basic catalog: Text, ChoicePicker, DateTimeInput, TextField, Button).
   The browser draws them with Umi's own parts (`a2ui.js`), following the approved mock (`docs/ui-review/askback-mock.html`).
   The answer returns as a `function_response` with the same taskId/contextId. Paused tasks and their ADK sessions are
   saved in D1, so Cloud Run can scale to zero in between. The answer is recorded in `clarifications`.
4. **Nagi consults Shiomi on its own.** `/api/nagi` now calls only Nagi. Nagi has a fifth tool, `ask_shiomi(task_ids, why)`,
   an A2A client built on the official JS SDK (`@a2a-js/sdk` 1.3.0). Limits: 2 consultations of up to 4 tasks per plan,
   one question to the user per plan. If Shiomi asks back, Nagi's own A2A task becomes `input-required` and its paused
   plan is saved in D1. The trace records each call: from, to, why, milliseconds, state, Shiomi's tools.
5. **Agent card.** Shiomi's card (`/.well-known/agent-card.json`) lists the skills `recall_corrections`, `effort_bias`,
   `ask_user`, and two extensions: `https://a2ui.org/a2a-extension/a2ui/v0.9` and `https://umi-lake.pages.dev/a2a/ask-back/v1`.

## Structure

```
Browser (Umi)
  └─ /api/nagi ──A2A──▶ Nagi        Cloudflare Pages, JavaScript, Gemini 2.5 Flash
                          ├─ get_day_budget · get_free_time · get_task · get_dive_history
                          └─ ask_shiomi ──A2A 1.0──▶ Shiomi   Cloud Run, Python + ADK, Gemini 2.5 Flash
                                                       ├─ recall_corrections · effort_bias ──▶ /api/memory ──▶ D1
                                                       └─ ask_user → input-required + A2UI card ──▶ back to the browser
```

Diagrams (flowchart and sequence) are in the README, section "Agents: Shiomi and Nagi over A2A".

## Production runs (umi-lake.pages.dev, 2026-11-28, made-up tasks, signed in)

### 1. Nagi consults Shiomi, and memory changes the judgment

Memory held one correction: "Write seminar report", effort 3 → 7.
Report: "Write seminar report draft" (source rule, confidence 0.3, effort 2), "Buy groceries", "Pay rent".

```json
{ "calls": [
    { "from": "app", "to": "nagi", "why": "plan Nagi mode" },
    { "from": "nagi", "to": "shiomi", "why": "The impact and effort sources are rules, and confidence is low.",
      "tasks": ["chk-a"], "ms": 7557, "state": "completed",
      "shiomiTools": ["recall_corrections", "effort_bias"],
      "judged": [{ "id": "chk-a", "confidence": 0.8, "memory": "For 'Write seminar report', user changed effort from 3 to 7." }] } ],
  "tools": ["get_day_budget", "get_free_time", "ask_shiomi"], "model": "gemini-2.5-flash", "ms": 14953 }
```

Result for the task: effort 2 → 4, impact 7, penalty 8, must true, confidence 0.3 → 0.8. Reason given: "A seminar report
is important for academics, and past user corrections suggest a higher effort for similar tasks."
Browser round trip: 15.8 s.

### 2. Shiomi asks back, the user answers, Shiomi resumes

Report: "prep" (source rule, confidence 0.3), "Pay rent".

Pause (browser round trip 9.5 s):

```json
{ "from": "nagi", "to": "shiomi", "why": "The impact and effort sources are rules, and the confidence is low.",
  "tasks": ["chk-p"], "ms": 4552, "state": "input-required", "shiomiTask": "00de9381-84f1-4847-ab6c-c426692521cb",
  "shiomiTools": ["recall_corrections", "effort_bias", "ask_user", "ask_user"] }
```

(`ask_user` is listed twice because the client counted the paused call from both the history and the status
message; fixed afterwards in `server/shiomi-client.js`.)

Shiomi's question: 'What is "prep" for?' with the choices it chose (work, study, personal errands, hobbies) and a deadline
toggle, drawn in the app from the A2UI messages. "work" was picked on the card and sent with "Answer".

Resume (browser round trip 12.5 s), same Shiomi task id:

```json
{ "from": "nagi", "to": "shiomi", "why": "passing on the user's answer", "tasks": ["chk-p"],
  "resumes": "00de9381-84f1-4847-ab6c-c426692521cb", "ms": 5284, "state": "completed",
  "judged": [{ "id": "chk-p", "confidence": 0.8, "memory": "User clarified 'prep' is for work." }] }
```

Plan: keep "Pay rent" ("It is a must-do task with a high penalty.") and "prep" ("It has high impact and dependency.").
Afterwards D1 held 1 clarification (`prep → { for: work, deadline: none }`) and 0 pending tasks.

### A run before the fix

The first production run (Nagi on gemini-2.5-flash-lite, softer instruction) did not consult Shiomi although one task was
a keyword guess with confidence 0.3; it planned in 3.4 s. The instruction was made firmer and Nagi moved to
gemini-2.5-flash; the decision to consult is still Nagi's.

## Numbers

| | |
|---|---|
| Nagi plan with one consultation | 15.8 s in the browser (Nagi 15.0 s, Shiomi 7.6 s of it) |
| Question reaches the browser | 9.5 s (Shiomi 4.6 s) |
| Answer to finished plan | 12.5 s (Shiomi 5.3 s) |
| Shiomi agent card fetch (warm) | 0.6 s |
| Consultations per plan | limit 2 (up to 4 tasks each); 1 in each run above |
| Questions to the user per plan | limit 1 |
| Offline test | 1 end-to-end test, 12 checks: card extensions, 401 without a token, input-required with an A2UI card, task saved, restart, resume with the same ids, completion, answer recorded, pending row deleted |
| Production checks | 3 of 3 passed (consult, ask → answer → resume, memory changes the judgment) |
| Sign-in | Shiomi, Nagi, `/api/nagi`, `/api/memory` all return 401 without a valid Firebase token |
| New code | about 1,060 lines (Shiomi Python, Nagi, memory API, A2A client, A2UI renderer, memory recording) |

## Not built

- Calendar access for `get_free_time`.
- Embedding search for similar titles (Vectorize + Workers AI).
- Shiomi used from other apps over A2A (task 5: Life Dashboard's `/api/weigh`).
- `/api/weigh` (judgment when a task is added) is still a single Gemini call on Cloudflare.
