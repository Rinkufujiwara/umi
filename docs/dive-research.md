# Dive (focus timer) — prior work → ideas → scoring → choice

2026-11-27. GitHub repositories created after 2025-09-26 (within 14 months) were searched with `gh search repos --created`, plus public sites and app stores.

## 1. Prior work

| Example | What is new | What to take |
|---|---|---|
| [FaceDown](https://github.com/arekbauer/FaceDown) (2026-01) | Runs only while the phone lies face down; picking it up pauses it | "Runs only while you are there": stop when you leave the screen (without blame) |
| [DeepHUD](https://github.com/hktjayaranga/deephud) (2026-09) | Jot down stray thoughts with a shortcut while focusing, review them in the break and turn them into tasks; the break guides box breathing | **Distraction notes → sort them in the break**, a breathing break |
| [Immerse 沉浸日程](https://github.com/debugzhao/Immerse) (2026-11) | A scheduled event becomes a focus session; nudges at 50% and 80%; turns on Do Not Disturb | Start from a task in one click; milestone signals |
| [Txori](https://github.com/rama-io/txori) (2026-03) | A roulette suggests what to do in the break (drink water, fix your posture) | Decide what the break is for |
| [Flow Timer](https://github.com/tianze-hou/FlowTimer) (2025-12) | For neurodivergent users: a timed flow through steps | Working without a fixed time |
| [Flowmodor](https://github.com/flowmodor/flowmodor) / [FlowTime](https://github.com/Glydric/FlowTime) / [FlowTime (Product Hunt, 2025-08)](https://www.producthunt.com/products/flowtime-focus-timer/launches) | Focus without a set time; when you stop, rest one fifth of it | **A break in proportion to the time spent** |
| [Pomodoist](https://github.com/Kabanya/Pomodoist) (2026-08) | A 3D companion keeps you company | A visual companion |
| [Forest](https://forestapp.cc/), [SeedFocus](https://apps.apple.com/app/id6810488625), [Bonsai](https://apps.apple.com/mx/app/bonsai-focus-study-timer/id6759262068) | Something grows while you focus and dies if you leave | Growth as a visual — but the punishment does not fit Umi's calm |
| [Moment](https://apps.apple.com/app/id6446064063) | Ocean, air, sand and forest themes | Only the look of the sea; the timer itself is ordinary |

Summary: the inventions are in four places — how the time is set (fixed or open), what happens to stray thoughts, how the break is decided, and what happens when you leave. None used the sea as part of the mechanism itself.

## 2. Ideas, in the sea

- **A — Air tank**: remaining time = air left; surface at zero. (A fixed pomodoro dressed as the sea.)
- **B — Free dive and decompression**: while diving, the camera really goes down through the lake; depth = time. After surfacing, "decompress" for one fifth of the dive (Flowmodoro explained by the sea itself). Time: 25 min, 50 min or no limit.
- **C — Bubble notes**: type a stray thought and it rises to the surface as a bubble. After surfacing, float each bubble as a task or drop it (DeepHUD's distraction notes as a movement of water).
- **D — Down the mooring line**: the dive goes under "The one for now" buoy; the camera descends right beneath it. After surfacing you can press *Sink (done)* (tied to the task).
- **E — Out of breath**: leaving the screen uses up your breath or forces you up (Forest's punishment).
- **F — Light by depth**: at 50% and 80% the water gets darker and the light shafts thinner (Immerse's milestones as light instead of sound).
- **G — Breathing with the waves**: during decompression, a breathing ring that follows the waves (4 s in, 4 s out).

## 3. Scoring (out of 5)

| Idea | Fits the sea | Tied to task management | New | Calm (no blame) | Easy to build on the current 3D | Total |
|---|---|---|---|---|---|---|
| A Air tank | 3 | 2 | 1 | 4 | 5 | 15 |
| **B Free dive and decompression** | 5 | 3 | 4 | 5 | 4 | **21** |
| **C Bubble notes** | 5 | 5 | 4 | 5 | 4 | **23** |
| **D Down the mooring line** | 5 | 5 | 3 | 5 | 4 | **22** |
| E Out of breath | 4 | 2 | 2 | 1 | 4 | 13 |
| F Light by depth | 5 | 1 | 3 | 5 | 4 | 18 |
| G Breathing with the waves | 4 | 1 | 2 | 5 | 5 | 17 |

Dropped: A is not new. E goes against "no blame". F and G are weak on their own, so they stay as part of B's presentation (F = darker with depth, G = the breathing ring in decompression).

## 4. Chosen: "Dive" = D + B + C (with F and G in the presentation)

1. **Pick where to dive**: "The one for now", or *Dive* on a buoy's card. Time: 25 min, 50 min or no limit.
2. **Dive**: the camera slowly goes down through the lake under that buoy. Depth = elapsed time (with no limit, it keeps getting deeper). The deeper, the darker. On screen: only the task name, the time, a depth gauge, the bubble note box and *Surface*.
3. **Bubble notes**: type and press Enter → a bubble rises to the surface.
4. **Surface**: when the time is up, or with *Surface*. Leaving the page does not stop or blame anything (time is counted by the clock).
5. **Decompression**: one fifth of the dive (at least a minute), with a breathing ring. Float or drop each bubble note. For the task: *Sink (done)* or *Dive again*.
6. Record: dive time is kept on the task (`t.dives`, total in `t.diveMin`).
