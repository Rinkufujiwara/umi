# Buttons and "what happens after a press" — research and proposal

2026-11-27. The 3D background is out of scope. In scope: the dashboard's buttons and the panels they open (card, add box, settings, Dive, toast).

## 1. Problems found
- About seven different button looks (btn / btn pri / addbtn / calm / nav / linkish / the Dive time buttons)
- The dark style (btn pri) meant both "do it" (Sink, Dive) and "currently selected" (weight, season, hours)
- The card showed seven buttons of nearly equal weight, so the main action was unclear
- Each panel opened differently (fade, drop down, instant) and at a different speed

## 2. The 30 references and their scores
Scoring: ① easy to use and read as a task dashboard ×3, ② simple, nothing wasted ×2, ③ fits the lake / Nagi concept ×1 (5 points each, max 30). ★ = adopted.

| # | Source | Name | What is good about it | ① | ② | ③ | Total |
|---|---|---|---|---|---|---|---|
| 1 | GitHub 129k★ | [shadcn/ui](https://github.com/shadcn-ui/ui) | Six button roles (default / secondary / outline / ghost / link / destructive), 36px tall, 3px focus ring | 5 | 5 | 3 | 28 ★ |
| 2 | GitHub 19.6k | [Radix Primitives](https://github.com/radix-ui/primitives) | Behavior of popovers and toggles (Esc, focus, arrow keys) | 5 | 4 | 3 | 26 ★ |
| 3 | GitHub 8.9k | [Radix Themes](https://github.com/radix-ui/themes) | solid / soft / surface / ghost levels and a Segmented Control | 5 | 4 | 3 | 26 ★ |
| 4 | GitHub 23.6k | [Magic UI](https://github.com/magicuidesign/magicui) | Glowing, shimmering buttons and effects | 2 | 2 | 3 | 13 |
| 5 | GitHub 11.2k | [coss.com/ui (Cal.com)](https://github.com/cosscom/ui) | Calm parts from a real product | 4 | 4 | 3 | 23 |
| 6 | GitHub 13.3k | [Sonner](https://github.com/emilkowalski/sonner) | How toasts stack; a little slower, with `ease` | 4 | 5 | 4 | 26 ★ |
| 7 | GitHub 8.8k | [Vaul](https://github.com/emilkowalski/vaul) | Drawer that slides up on phones | 4 | 4 | 4 | 24 |
| 8 | GitHub 13.2k | [cmdk](https://github.com/dip/cmdk) | Command menu opened from the keyboard | 4 | 4 | 2 | 22 |
| 9 | GitHub 35.6k | [Motion](https://github.com/motiondivision/motion) | press / animate / layout usable from plain JS | 4 | 4 | 4 | 24 |
| 10 | GitHub 7.0k | [motion-primitives](https://github.com/ibelick/motion-primitives) | Patterns for animated parts | 3 | 3 | 3 | 18 |
| 11 | GitHub 52.8k | [React Bits](https://github.com/DavidHDev/react-bits) | Mostly decorative animation | 2 | 2 | 3 | 13 |
| 12 | GitHub 5.5k | [Ark UI](https://github.com/chakra-ui/ark) | State handling for toggles and switches | 4 | 4 | 3 | 23 |
| 13 | GitHub 16.1k | [React Spectrum](https://github.com/adobe/react-spectrum) | A "press" that behaves the same for mouse, touch and keyboard | 4 | 3 | 2 | 20 |
| 14 | GitHub 31.3k | [HeroUI](https://github.com/heroui-inc/heroui) | Shrink and ripple on press | 3 | 3 | 3 | 18 |
| 15 | GitHub 43.0k | [daisyUI](https://github.com/saadeghi/daisyui) | Button roles by class name only | 3 | 4 | 2 | 19 |
| 16 | GitHub 28.8k | [Headless UI](https://github.com/tailwindlabs/headlessui) | Different speeds for entering and leaving | 4 | 5 | 3 | 25 ★ |
| 17 | GitHub 5.1k | [Animate UI](https://github.com/imskyleen/animate-ui) | A distribution of animated parts | 3 | 3 | 3 | 18 |
| 18 | GitHub 7.7k | [Cult UI](https://github.com/nolly-studio/cult-ui) | Eye-catching effect parts | 2 | 2 | 3 | 13 |
| 19 | GitHub 1.4k | [Web Awesome](https://github.com/shoelace-style/webawesome) | Parts usable without a framework | 3 | 3 | 2 | 17 |
| 20 | GitHub 11.5k | [Material Web](https://github.com/material-components/material-web) | Durations and curves defined as tokens | 4 | 3 | 2 | 20 |
| 21 | motion.dev | [Press](https://motion.dev/examples/js-press) | Shrinks on press, springs back on release | 4 | 5 | 3 | 25 ★ |
| 22 | motion.dev | [Long press](https://motion.dev/examples/js-press-hold) / [Hold to confirm](https://motion.dev/examples/js-hold-to-confirm) | A ring fills while held (Umi already does this) | 4 | 4 | 4 | 24 |
| 23 | motion.dev | [Tab select](https://motion.dev/examples/js-tab-select) | A white pill slides to the chosen item (0.3 s) | 5 | 5 | 4 | 29 ★ |
| 24 | motion.dev | [Shared layout](https://motion.dev/examples/js-shared-layout-animation) | The underline moves and icons swap up/down | 4 | 4 | 4 | 24 |
| 25 | motion.dev | [Modal dialog](https://motion.dev/examples/js-modal) | Native dialog with enter/leave motion and a backdrop | 4 | 4 | 3 | 23 |
| 26 | motion.dev | [Notifications stack](https://motion.dev/examples/js-notifications-stack) | Notifications stack and spread on press | 3 | 3 | 3 | 18 |
| 27 | motion.dev | [Accordion](https://motion.dev/examples/js-accordion) | Height motion when opening and closing | 3 | 4 | 3 | 20 |
| 28 | motion.dev | [Reorder items](https://motion.dev/examples/js-reorder-items) | Reordering | 3 | 3 | 3 | 18 |
| 29 | Write-up | [Emil Kowalski, "Great animations"](https://emilkowal.ski/ui/great-animations) | Under 300 ms, ease-out on enter, no motion for keyboard actions, only transform and opacity | 5 | 5 | 4 | 29 ★ |
| 30 | Write-up | [Apple HIG: Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | One or two prominent buttons per view; hit area at least 44×44 | 5 | 5 | 3 | 28 ★ |

Not adopted: glowing and shimmering effects (#4, #11, #18). They catch the eye but go against Nagi's calm.

## 3. Button rules (three roles plus toggles)
| Role | Look | Used for |
|---|---|---|
| Primary | Dark teal, white text. **One per view** | Sink, Dive (in its setup), Float, Add a task |
| Secondary | Near-white surface + thin line | Dive (on cards), +1 day / +3 days / +1 week, Dive again |
| Quiet | Text only; a light tint on hover | Tomorrow, Lighter, Edit in table, Cancel, Back to the surface |
| Danger | Same as quiet, red text, at the right end | Delete |
| Toggle | A white pill slides in a grey track (#23) | Weight, season, weather, hours per day, Dive time, language |
| Switch | The existing Nagi mode switch | Nagi mode |

- 36px tall (hit area up to 44px on phones), 10px corner radius, matching the panel corners instead of pill shapes
- On press: shrink to 0.97 and spring straight back (#21; 0.8 is too much)

## 4. Motion rules (the same everywhere)
| Motion | Duration | Curve | Shape |
|---|---|---|---|
| Open (card, add box, settings, Dive) | 220 ms | ease-out (cubic-bezier(.2,.8,.2,1)) | Rises 8px from below near the button that opened it (0.98 → 1, transparent → opaque) |
| Close | 160 ms | ease-in | Sinks out of view (like sinking in water) |
| Toggle pill | 300 ms | cubic-bezier(.4,0,.2,1) (as in #23) | Slides sideways |
| Toast | 400 ms | ease (#6) | Rises from below |
| Opened from the keyboard | No motion (#29) | | |
| Reduced motion | Opacity only, 120 ms | | |

Tie to the concept: opening = "floating up", closing = "sinking". No other effects (no ripples or glow).

## 5. Before and after
`before-after.png` (a render of `mock.html`). Left: before; right: the proposal (as revised after review: no explanation lines, weight and "farther" side by side).

## 6. Steps (after approval)
1. Tag a restore point
2. Put the rules into CSS variables (colors, heights, durations, curves) and replace every button and panel motion
3. Measure misalignment and overflow at three widths and on phones with tools/align-check
4. Press everything for real, then commit, push and deploy
5. Then: make buoys one size in the sky view, changing gradually with the camera move
