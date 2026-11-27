# Nagi agent — design

Status: proposal (2026-11-28). Nothing here is built yet.

## 1. Why

Today, Nagi mode is plain code: it sorts today's tasks by a formula (W) and keeps the top three.
Shiomi is a single model call that scores each task. Neither one plans.

The goal is two agents with clear jobs and a defined handoff:

- **Shiomi judges** each task on its own (what is it worth, what does missing it cost, how long does it take).
- **Nagi plans** the next few hours: given Shiomi's judgments, your calendar and the time you have, it picks the three to keep afloat and explains why.

Each agent stays small and testable, the handoff between them is an explicit contract, and Nagi still follows the app's rule of calm: it only **proposes**. It never changes tasks by itself.

## 2. What exists today

| Part | Where | What it does |
|---|---|---|
| Shiomi | `api/weigh.js` (Vercel function) → Gemini 2.5 Flash-Lite | For up to 12 tasks: impact, penalty, effort, dependency (1–10), must (true/false), two short reasons |
| Must / own | `store.js` `values()` | What **you** set (typed "must"/"own", or chosen in the table) > Shiomi's `must` > fallback rule (penalty ≥ 6) |
| Order W | `store.js` `compute()` | `W = V / hours^0.6 × U(slack)`; urgency rises steeply as slack runs out |
| Nagi mode | `home.js` `calmSet()` | Top 3 of today's tasks by W; the rest sink out of view |

## 3. Roles

| | Shiomi (judge) | Nagi (planner) |
|---|---|---|
| Question it answers | "How heavy is this task?" | "Which three now, and why?" |
| Scope | One task at a time (batched), no memory of the day | Today as a whole |
| Runs when | A task is added or renamed | Nagi mode is turned on; the first open of the day; a kept task is sunk; the calendar changes |
| Inputs | Title, notes, area, has-a-due-date, your corrections as examples | **Shiomi's report** + due dates and slack + your calendar + hours per day + dive history |
| Tools | None | Read-only tools (§6) |
| Output | Scores and reasons per task | A plan: three to keep, suggestions for the rest, one short message |
| Writes to your data | Only its scores (`t.ai`) | Nothing. Suggestions need your tap |

## 4. The handoff: Shiomi → Nagi

The app does not pass Shiomi's raw answer along. It builds a **report**: Shiomi's judgment plus the numbers the app computes, so Nagi plans on facts and does not have to recompute them.

```jsonc
// ShiomiReport — one per planning run
{
  "version": 1,
  "generatedAt": "2026-11-28T09:12:00+01:00",
  "timezone": "Europe/Madrid",
  "lang": "en",                          // language for anything shown to the user
  "dayBudgetMin": 300,                   // hours you can use in a day (Settings)
  "tasks": [
    {
      "id": "yov3drgtozso",
      "title": "Hand in the presentation",
      "due": "2026-11-28", "time": null,  // due date and time, if any
      "estMin": 120,                      // your estimate, or Shiomi's effort mapped to minutes
      "slackDays": 0.6,                   // days until due − days of work (computed by the app)
      "order": 48.8,                      // W, the app's own ranking (Nagi may disagree, with a reason)
      "judgment": {
        "impact": 7, "penalty": 7, "effort": 4, "dependency": 1,
        "must": true,
        "source": "shiomi",               // "you" | "shiomi" | "rule": who decided each value
        "reason": "Needed for the course credit; the deadline is close.",
        "confidence": 0.8                 // new: how sure Shiomi is (0–1)
      }
    }
  ]
}
```

Notes:
- `source` matters: when **you** set a value, Nagi must treat it as fixed.
- `confidence` is new. Shiomi already returns a reason; asking for a confidence lets Nagi ask a clarifying question instead of guessing when a title is vague ("Prep" with no context).
- Only today's and this week's open tasks are sent. Nothing from the lakebed (finished tasks).

## 5. Nagi's output

```jsonc
// NagiPlan
{
  "version": 1,
  "keep": [                               // exactly up to three, in order
    { "id": "yov3drgtozso", "why": "Due tonight and you have a free block from 14:00." },
    { "id": "…", "why": "…" },
    { "id": "…", "why": "…" }
  ],
  "suggest": [                            // optional; each needs your tap
    { "id": "…", "action": "tomorrow", "why": "No free time left today after 18:00." },
    { "id": "…", "action": "lighter",  "why": "…" },
    { "id": "…", "action": "dive",     "minutes": 50, "why": "Fits your 14:00–15:00 gap." }
  ],
  "message": "A full afternoon. Start with the presentation.",   // one line, calm tone
  "validUntil": "2026-11-28T13:00:00+01:00"                      // re-plan after this
}
```

Rules the app enforces on the plan (it never trusts it blindly):
- Every `id` must exist and be open; otherwise the plan is dropped.
- `keep` must include every task **you** marked must that is overdue (a safety rule).
- `action` must be one of `tomorrow`, `lighter`, `later`, `dive`. Anything else is ignored.
- Texts are trimmed to a short length and shown as plain text.

## 6. Nagi's tools (read-only)

| Tool | Gives Nagi | Source |
|---|---|---|
| `get_free_time(date)` | Free blocks today, from your calendar | Google Calendar (read-only scope), through an MCP server or the Calendar API |
| `get_day_budget()` | Hours per day, minutes already used today | App data |
| `get_dive_history(days)` | When and how long you usually focus | App data (`t.dives`) |
| `get_task(id)` | Notes and history of one task, when the report is not enough | App data |

No tool can change anything. Changes happen only when you tap a suggestion, through the same code paths the buttons use today (`postpone`, `lighter`, `openDive`).

## 7. Flow

```mermaid
sequenceDiagram
  participant U as You
  participant App as Umi (browser)
  participant S as Shiomi
  participant N as Nagi
  participant T as Tools (calendar, app data)

  U->>App: add or rename a task
  App->>S: tasks to judge
  S-->>App: scores + reasons + confidence
  U->>App: turn on Nagi mode
  App->>App: build ShiomiReport (scores + due, slack, W)
  App->>N: ShiomiReport
  N->>T: get_free_time, get_day_budget, …
  T-->>N: free blocks, minutes used
  N-->>App: NagiPlan
  App->>App: check the plan (§5 rules)
  App-->>U: three buoys stay afloat, each with a one-line "why"
  U->>App: tap a suggestion (optional)
```

## 8. Protocols

| Layer | Choice | Why |
|---|---|---|
| Agent ↔ agent | **A2A** (Agent2Agent): each agent publishes an agent card; the report goes over as a task with the JSON above as its data part; the plan comes back as an artifact | A standard, inspectable handoff instead of a hidden function call; either agent can be swapped or tested alone |
| Agent ↔ tools | **MCP** for the calendar; plain functions for app data | Calendar access is a separate, permissioned service; app data is already in the request |
| Agent framework | **ADK** (Agent Development Kit) for both agents | Tool calling, sessions and evaluation built in |
| Agent → UI | Phase 2: **A2UI**-style declarative cards for Nagi's suggestions | The agent describes the card ("suggestion with Accept / Not now"); the app renders it with its own buttons and styles |

## 9. When things go wrong

| Situation | What happens |
|---|---|
| Nagi is slow (over 4 s) or fails | Fall back to today's code: top 3 by W. A small "planned by formula" label shows |
| Shiomi has not judged a task yet | The report uses the rule estimate with `source: "rule"` and a low confidence |
| Calendar not connected | Nagi plans from hours per day only and says so in its message |
| The plan breaks a rule (§5) | Dropped; fall back to W |
| Offline / signed out | Nagi is off; Nagi mode works as today |

## 10. Cost and timing

- One Nagi run = one model call plus up to four tool calls. With Flash-Lite, roughly the same tiny cost as a Shiomi batch.
- Runs only on the triggers in §3, at most once every 10 minutes, and the plan is cached until `validUntil`.
- The same sign-in check and allow-list as `/api/weigh`.

## 11. Changes in the app

- Nagi mode: each kept buoy's tag gets the one-line "why" (hover, or the card).
- The Nagi message replaces the date line while Nagi mode is on.
- Suggestions appear as quiet buttons on the card: *Move to tomorrow* · *Not now*.
- The card's "Shiomi" line stays as it is; a "Nagi" line appears only for kept tasks.

## 12. How to judge it

- Log each plan next to the formula's top 3. Measure how often you accept suggestions, how often kept tasks get sunk that day, and how often you turn Nagi mode off soon after it plans.
- A small fixed test set (about 20 days of made-up tasks and calendars) run on every prompt change (ADK evaluation).

## 13. Phases

1. **Contract first**: build the ShiomiReport and NagiPlan types and the plan checks, with a "formula Nagi" that returns the current top 3 in the NagiPlan shape. No model yet.
2. **Nagi agent** on ADK with the app-data tools; A2A between Shiomi and Nagi; the fallback in §9.
3. **Calendar** through MCP (read-only), behind a Settings switch.
4. **Suggestions as A2UI cards**, and the evaluation set.

## 14. Decisions needed

1. **Hosting**: keep the agents in Vercel functions (Node), or run them with ADK on Cloud Run (Python) and have Vercel call them. Recommended: Cloud Run, since ADK and A2A are most complete there.
2. **Calendar**: connect Google Calendar (read-only) or not. Without it, Nagi plans from hours per day only.
3. **Real A2A or an in-process contract** for phase 2. Recommended: real A2A between two services, since that is the point for the portfolio.
4. **How much Nagi may suggest**: only "tomorrow", or also "lighter" and "dive".
