# Coco game: visual approval preview

This records the approved visual checkpoint. The design has now been integrated,
with the requested clearer Coco/cat sprite. See [the final report](REPORT.md) for
the real session flow, flying controls, and verification.

[Full night page](night.png) · [Full daylight page](day.png) ·
[Morning](morning.png) · [Sunset](sunset.png) ·
[Four-palette comparison](palette-comparison.png) ·
[Game over](night-over.png) · [Compact layout](day-compact.png) ·
[Motion preview](motion.gif)

## Proposed design

- Light Coco surfaces and shared typography, rounded game card, subtle shadow,
  pill controls, and one primary action per state.
- Four scenery layers moving at different speeds: pixel-shaded mountains,
  rolling hills, trees, and foreground meadow details.
- Drifting clouds, birds, twinkling stars/sun rays, animated grass, and ambient
  fireflies or leaves. Landing dust and a brief hit flash.
- Textured ground with grass edges, roots, pebbles, small rocks, and flowers.
- Coordinated morning/day/sunset/night colors across the whole scene, matching
  titles, and a themed game-over card.
- The existing ObservationBubble component and fox illustration, placed clear
  of the game controls. Native floating-avatar integration follows approval.

## What was verified

The images are captured from actual React and Chromium Canvas rendering. They
use the existing game simulation with the proposed renderer, deterministic
preview frames, and illustrative original/review states. The game-over card is
reached through a real simulation collision. These are visual review fixtures,
not claims that the agent has published these changes.

The six captures fit inside the normal and compact viewports without clipping
or vertical overflow; see [layout measurements](layout.json). All four palettes
and the collision card were visually inspected. The animation is assembled from
36 actual canvas frames. TypeScript checking and the isolated preview build
passed. No services, models, permissions, or tutorial state were changed.

## Next, after screenshot approval

Promote the approved presentation and scene data into the validated workspace;
wire Start Task directly to the game window, the bubble sequence, chat handoff,
and three prompt suggestions; implement and test held-input flying in the
behavior module. Then run the full real-model/default-permission session and
prompt regressions and report all remaining failures.

Source and reproduction instructions: `desktop/design/game-polish/README.md`.
