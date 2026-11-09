# Custom character generation — verification

Verified November 8, 2026, before the 11 PM submission deadline.

The chat agent calls a dedicated vision artist. The artist supplies colored body parts; the app rasterizes them into 34×26 pixel sprites, creates a stable-body stride and a 34×12 crouch, preserves obstacle colors, and validates the game in Chromium. An independent vision review checks subject recognition, finish, in-game readability, and crouch identity. Failed checks trigger repair; unsuccessful turns retain the previous game.

| Character | Result | Time | Evidence |
|---|---|---:|---|
| Turtle | Pass | 49.5s | [Game](turtle-0-scene.png) · [Sprite sheet](turtle-0-contactSheet.png) · [Review](turtle-0-review.json) |
| Robot | Pass | 50.0s | [Game](robot-0-scene.png) · [Sprite sheet](robot-0-contactSheet.png) · [Review](robot-0-review.json) |
| Owl | Pass | 49.0s | [Game](owl-0-scene.png) · [Sprite sheet](owl-0-contactSheet.png) · [Review](owl-0-review.json) |
| Elephant | Pass | 54.6s | [Game](elephant-0-scene.png) · [Sprite sheet](elephant-0-contactSheet.png) · [Review](elephant-0-review.json) |
| Dragon | Pass | 166.3s | [Game](dragon-1-scene.png) · [Sprite sheet](dragon-1-contactSheet.png) · [Review](dragon-1-review.json) |

All five began from a fresh game in disposable workspaces using real configured models and the actual agent tools. No approval prompts were auto-answered; all five recorded zero approval requests. Browser checks exercised rendering, jumping and ducking. The tests did not alter the account’s saved game.

Turtle and robot passed in the initial final verification run. Owl, elephant and dragon were rerun after correcting review-response formatting, false animation-phase critiques, and missing optional-motion handling. Earlier failed runs are not counted as successes. Dragon required a visual repair; its final approved image is shown here.

Validation: 91 focused TypeScript tests, 13 Python bridge tests, typecheck, and the development build passed. The image-tool integration check passed. A negative control correctly rejected the unchanged fox when a turtle was requested; see [negative-control.json](negative-control.json).

Limits: these are five sampled live requests, not a guarantee that every future request will produce good artwork. Complex custom art can take longer than a theme/color edit. The automated visual review remains model-based; the supplied screenshots allow human inspection. These tests cover the agent/artist/browser/review pipeline, not a repeat of the entire login/onboarding flow or a packaged clean-machine installation.

To try it in Coco: open Play with Coco → Make it yours, then ask “Make the runner a turtle” or describe another character. No new API-key setup is required with the currently connected account.
