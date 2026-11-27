# Umi

A task dashboard where tasks float as buoys on a low-poly lake. Finish one and it sinks, piling up on the lakebed.

Live: https://umi-ten.vercel.app

The interface is in English by default; Japanese can be chosen in **Settings → Language** (or open the page with `?lang=ja`).
A few names are kept as they are in both languages: **Umi** (the app, "sea"), **Nagi** (the calm mode, "a dead-calm sea") and **Shiomi** (the AI that weighs tasks, "tide-watcher").

## How it works

- **Where a buoy floats**
  - **Front ↔ back = slack**: days until the due date minus the days of work. Anything within a day (late, half a day, today) sits on the front line; 3 more days of slack reach the middle; no due date floats at the back.
  - **Right ↔ left = weight**: light tasks stay near the shore on the right; heavy ones drift offshore to the left (we read from the left, so the heavy ones come first).
  - **Size = effort**: bigger buoys take longer.
- **Sink**: press a buoy and choose *Sink*, or long-press it (0.7 s). It drops through the water and piles up on the lakebed.
- **Views**: scroll (or use the arrow keys) to move between the *Overview* from the sky, the surface, and the *Lakebed*.
- **Nagi mode**: the water swells once and settles, every buoy except the three to do now sinks out of sight, and the camera frames the three that remain.
- **Dive (focus timer)**: dive under one task's buoy (25 min, 50 min or no limit); depth follows the time. Stray thoughts become *bubble notes* that rise to the surface. When you surface, take a *decompression* break of one fifth of the dive, then float the bubble notes as tasks or drop them.
- **Sky and water**: the light follows the time of day (morning, day, evening, night with a moon). The weather follows how busy you are: today's tide (estimates ÷ the hours you can use in a day) + 0.5 × the next 7 days + 0.25 × late tasks + 0.12 × urgent tasks → Nagi < Ripples < Waves < Rough < Storm.
- **Alerts**: a small fin circles a risky must-do task and nudges it now and then.
- **Quick entry**: type `tomorrow 3pm stats homework #school 1h must heavy weekly` (or the Japanese 「明日15時 統計の課題 #大学 1時間 必須 重い 毎週」) and the date, time, area, estimate, type, weight and repeat are read from it.

## Weighting

Shiomi (Gemini, through `/api/weigh`) judges only four values per task, 1–10: **I** value, **P** cost of missing it, **E** effort, **D** others waiting, plus whether it is a **must**. Everything else is computed in the browser (`store.js`):

```
weight   V = (I^1.2 × aging + P^1.3) × D'        D' = 1 + (D − 1) / 9
urgency  U = (1 + 2 / (max(0, slack) + 0.5))^1.5
order    W = V / hours^0.6 × U                    (the card order, Nagi mode's three, the fin alerts)
```

Values you set by hand win over Shiomi, and Shiomi wins over a keyword estimate. Tasks whose weight you corrected are sent as examples, so Shiomi learns your yardstick. Its short reasons come back in the language you use.

## Data and sign-in

- Signed out, data stays in this browser (`localStorage`).
- Signed in with Google (Firebase Auth), data is one Firestore document per person (`umi/{uid}`) and syncs across devices.
- `/api/weigh` checks the Firebase ID token and an allow-list before calling Gemini. Set these on Vercel: `GEMINI_API_KEY`, `ALLOWED_EMAILS`, and optionally `GEMINI_MODEL`.

## Built with

three.js (Water, Sky), GSAP (Observer), SunCalc, chrono-node, SortableJS, tinykeys, Lenis. No build step; it is served as static files.

```
python -m http.server 8835
```

Layout checks: `sh tools/align-check.sh` measures the shared layout lines at three widths.

## Docs

- `docs/dive-research.md` — prior work, ideas and scoring behind Dive
- `docs/improve-set1.md`, `docs/improve-set2.md` — two review rounds (30 issues found, 15 fixed each)
- `docs/ui-review/README.md` — the button and motion rules, with the 30 references they came from
- `docs/shore-references.md` — references behind the land/water cut-away
- `docs/nagi-agent-design.md` — design for a Nagi planning agent with a handoff from Shiomi (proposal)
