# Improvement set 2 (2026-11-27)

Restore point: tag `restore/before-set2` (commit a38d639). To go back before set 1, use `restore/before-set1`.

## The 30 issues found (◎ = one of the 15 fixed this round)

The 15 items left from set 1 (#16–30) were reviewed again, and 15 new ones were found at phone width (375px) and on the live site.

| # | Kind | Issue | Fixed |
|---|---|---|---|
| 1 | Bug | On phones the left column is hidden, so there was no way to reach the Overview, Lakebed or Dive (only scrolling) | ◎ |
| 2 | Bug | On phones there was no way to sign in or open Lake & settings | ◎ |
| 3 | Look | On phones "Add a task" dropped to a second line | ◎ |
| 4 | Look | On phones the bubble note placeholder was cut off | ◎ |
| 5 | Controls | Pressing "Lakebed 36 ↓" at the bottom left did nothing | ◎ |
| 6 | Clarity | Nothing said that a long-press on a buoy sinks it | ◎ |
| 7 | Controls | No key to start a dive (set 1 #29) | ◎ |
| 8 | Clarity | The "Lake & settings" menu had no Nagi mode (set 1 #16) | ◎ |
| 9 | Missed signal | The tab title did not show the time left in the break | ◎ |
| 10 | Look | At night the bubble note lines were hard to see (set 1 #30) | ◎ |
| 11 | Data | Dive records grew forever (set 1 #26) | ◎ |
| 12 | Controls | Pressing "2 urgent" did nothing (you want to see which ones) | ◎ |
| 13 | Wording | "12m" alone did not say what the number was (set 1 #24) | ◎ |
| 14 | Controls | Diving from the Overview or Lakebed waited about 2 s for the trip home (set 1 #22) | ◎ |
| 15 | Look | The priorities panel had empty space at the bottom (set 1 #18) | ◎ |
| 16 | Sync | An in-progress dive lives on one device only (set 1 #17) | |
| 17 | Table page | The table page (list.html) does not show dive time (set 1 #19) | |
| 18 | Speed | The Nagi framing creates vectors every time (set 1 #20) | |
| 19 | Information | Below 1180px "time left" disappears (set 1 #21) | |
| 20 | Bug | Opening with ?view= while resuming a dive moves the camera twice (set 1 #23) | |
| 21 | Look | In shallow water the scenery above shows through a little (set 1 #25; lessened by the camera change) | |
| 22 | Table page | The table page ignores Nagi mode (set 1 #27) | |
| 23 | Look | On short screens Nagi's three tags come close to the top panels (set 1 #28) | |
| 24 | Confirm | The first dive asks for notification permission without warning | |
| 25 | Look | On phones the lake cut-away (bottom half) is large and the top feels cramped | |
| 26 | Controls | "Surface" during a dive has no confirmation (mis-taps) | |
| 27 | Look | On phones a tag sometimes overlaps the cut-away line | |
| 28 | Controls | "Edit in table" in the card leaves the 3D page | |
| 29 | Information | The lakebed list does not show total dive time | |
| 30 | Accessibility | The arrow of the select in the night-time Dive setup is hard to see | |

## How the 15 were picked
First the things phones could not reach or press at all (#1–3). Then places where pressing did nothing (#5, #12) and things you could not notice (#6, #9), and last small visual and data clean-ups.
