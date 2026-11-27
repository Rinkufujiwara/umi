# Improvement set 1 (2026-11-27)

Restore point: tag `restore/before-set1` (commit 6293a3d).

## The 30 issues found (◎ = one of the 15 fixed this round)

| # | Kind | Issue | Fixed |
|---|---|---|---|
| 1 | Bug | At 1100px and below, "The one for now" disappeared (the most important card) | ◎ |
| 2 | Bug | In Nagi mode, "Today's priorities" still showed cards for tasks whose buoys were hidden | ◎ |
| 3 | Bug | Buoys sinking away in Nagi mode could still be clicked or long-pressed | ◎ |
| 4 | Readability | The Dive setup and break panels had no dimmed backdrop and overlapped the panels | ◎ |
| 5 | Missing | No way to delete a task from home | ◎ |
| 6 | Missed signal | A timed dive ending in another tab went unnoticed | ◎ |
| 7 | Missed signal | No signal when the decompression break ended | ◎ |
| 8 | Hidden | Dive time was recorded but shown nowhere | ◎ |
| 9 | Look | The "Dive" item in the left column was not marked while diving | ◎ |
| 10 | Bug | Resizing the window in Nagi mode pushed the three out of frame | ◎ |
| 11 | Accessibility | With reduced motion, long camera moves and the swell still played | ◎ |
| 12 | Controls | Esc did not close the break panel; Enter did not start a dive from setup | ◎ |
| 13 | Controls | The dive target was one long list; today's tasks were hard to find | ◎ |
| 14 | Clarity | In the Overview with Nagi on, it said "13 afloat" while only three were visible | ◎ |
| 15 | Phones | Long-pressing selected text or opened a menu on phones | ◎ |
| 16 | Look | The "Lake & settings" menu did not mention Nagi mode | |
| 17 | Sync | An in-progress dive lives on one device only | |
| 18 | Look | Matching the priorities panel's height to "The one for now" left empty space | |
| 19 | Table page | The table page (list.html) did not show dive time | |
| 20 | Speed | The Nagi framing created vectors every time (light, but wasteful) | |
| 21 | Information | Below 1180px the "time left" text disappeared (only in a tooltip) | |
| 22 | Controls | Diving from the Overview waited about 2 s for the trip home | |
| 23 | Bug | Opening with ?view= while resuming a dive moved the camera twice | |
| 24 | Wording | The "m" for depth did not say much | |
| 25 | Look | In shallow water the scenery above the surface showed through a little | |
| 26 | Data | t.dives grew forever (no summary) | |
| 27 | Table page | The table page ignored Nagi mode | |
| 28 | Look | On short screens, Nagi's three tags came close to the top panels | |
| 29 | Controls | No key to start a dive | |
| 30 | Look | At night, the lines in the break panel's bubble notes were hard to see | |

## How the 15 were picked
Things that break or disappear (bugs) first, then things you cannot notice or see, then things that are awkward to use. Purely visual items and big jobs (like sync) were left for later.
