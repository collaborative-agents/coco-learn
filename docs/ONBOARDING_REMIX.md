# Coco: play, describe, build, and check

## Experience

Training tasks → Play with Coco → Start Task opens a separate native game
window directly, keeping Training available. The existing floating avatar
introduces the activity, then explains playing and Make it yours. The introduction
stays visible until acknowledged; proactive-advice suppression cannot clear an
explicitly started lesson. Space jumps and Down ducks. The game-over invitation
and persistent Make it yours action both open customization.

The game page uses shared Coco typography, light surfaces, rounded cards, and
pill controls, with one primary action per state. The game itself has pixel-shaded
mountains, hills, forest, and foreground meadow moving at different speeds,
animated clouds/birds/stars/grass/particles, textured ground, landing dust, hit
feedback, and a themed game-over card. Its Coco and cat sprites have distinct
faces, ears, paws, tails, and running/crouching poses.

Make it yours brings the existing agent interface forward with the actual game
workspace and an empty composer. Coco asks “What do you want to change about your
game?” Three examples offer daylight, flying, and a snowy-night cat. Clicking
inserts an example without sending; Copy preserves the current draft. Own prompts
remain fully supported. Reopening retains unsent text. Coaching uses the existing
ObservationBubble and encourages describing appearance, vibe, what to keep, and
checking the result. Check my understanding interprets the draft without editing.

Send uses the configured model and the normal Pi agent pipeline. Friendly work
labels appear in chat; technical events stay behind **Details · Locked**. The
gate intentionally remains. The game shows Original game, Previewing changes ·
checking, or Updated game. Open my game appears only after a published update.
A failed change shows its cause and Try again, retaining the working version.
Questions receive the model's answer without needing an edit.

Looks good offers a takeaway bubble; Continue completes the activity. Undo
restores an earlier published version. Closing the app during a run retains the
last published game and the original request, and explains the interruption on
reopening instead of pretending the draft was published.

## Small, data-driven game workspace

The source of truth is `desktop/src/main/game/`. The template packaging script
copies six files into each tutorial workspace:

| File | Responsibility | Agent access |
| --- | --- | --- |
| `theme.json` | All art, palette, scene, weather, title, score label, sounds, physics | Editable |
| `behavior.js` | Optional `onStep`, `onJump`, `onHit` hooks for new mechanics | Editable |
| `engine.js` | Canvas drawing, simulation, controls, collision, score | Locked |
| `theme.schema.json` | Declarative theme constraints | Locked |
| `GUIDE.md` | Short schema and editing guide | Locked |
| `examples.json` | Daylight, cat/bones, snowy night, harder, flying | Locked |

The engine obtains its visual choices from the theme, including the four
parallax layers and their speeds, ambient details, effects and HUD colors: solid/gradient sky,
morning/day/sunset/night, sun/moon/stars/clouds/mountains/trees, ground, weather,
sprite palette, and pixel grids. Sprite frames are rectangular grids from 4×4
through 48×48, with 1–8 same-sized frames; obstacle IDs are arbitrary and unique.
Colors are six-digit hex. Physics is bounded by the schema.

The preferred agent tool is `update_game_theme({changes})`. Objects merge,
arrays replace, changing time of day applies a complete scene/ground palette
and an automatic matching title, and explicit values override it. Custom titles
are preserved. Pet and obstacle shortcuts expand into editable pixel data (cat,
dog, rabbit; bones, cactus). Custom pixel grids are also supported. Each call
validates before writing and reports the actual diff. A malformed file can be
repaired from the last valid draft using the same tool. Other mechanics belong
in the small behavior module; the engine stays protected.

Flying uses `update_game_theme({changes:{behaviorPreset:"flight"}})`. The scoped
host operation installs actual code in behavior.js plus matching Fly/Descend
controls; it does not rewrite the engine. Held keyboard/pointer state is available
as state.input.jumpHeld/duckHeld. Hold Space, Up, or Fly to rise; release to fall.
Down/Descend falls faster. Inputs clear on blur/cancel/pause. The engine clamps
floor/ceiling safely. `behaviorPreset:"run"` restores jumping. Arbitrary new
mechanics can still use the documented hooks.

No build, shell script, npm install, or shell approval is needed for a theme
change. Polling notices edits and atomic file replacements. Valid drafts preview
automatically; invalid drafts keep the last working preview and display the
diagnostic. A valid manual edit outside an agent turn receives the same browser
check and publish process.

## Validation, permissions, and recovery

The app checks regular files, symlinks, size limits, stable-core hashes, JSON
schema, sprite grids and palette references. It then loads the assembled game in
a real sandboxed Chromium BrowserWindow, testing rendering, jump, finite player
state, advancing gameplay, actual held/released flight, and crouching under
flying obstacles. Relabeling Jump as Fly without flight behavior fails the check. Canvas gradients and paths use Chromium's real
implementation. The browser check has an eight-second timeout and destroys its
window on completion or failure. The playable document denies external network
connections and has no Node access.

Only the captured sources that passed validation are published as an immutable
version. A failed attempt receives its actual diagnostic and up to two automatic
repair attempts. Exhausted repairs roll back to the prior version. No-edit
questions remain normal answers; no-edit change requests receive an honest
explanation. Tutor context receives authoritative status and failure facts and
must not invent a cause or tell users to shrink an achievable request.

Tutorial-owned files have narrowly scoped host access. Shell tools are absent
in game mode; access to unrelated files still follows normal permissions. Any
pending approval pauses all active-work timers, and the avatar explains the
wait. The walkthrough fails on an approval prompt and never answers it. The
45-second notice and two-minute stop count active work only.

The selected DeepSeek route needed its reasoning option forwarded inside the
Router's explicit provider-options envelope. Root-level options were rejected;
the verified nested `reasoning_effort: none` setting avoids spending the response
budget on hidden reasoning. The selected model is unchanged. Provider response
latency can still exceed the theme-edit target.

Existing theme-based games receive the new renderer while retaining custom art,
rules, physics, scores, and original version files with a state backup. Legacy
activity files and version folders are archived and retained when moving
to the new template; old customized JavaScript artwork is not automatically
translated into the new theme schema.

## Verification

See [the polished-flow verification report](../artifacts/game-polish/REPORT.md)
and [the earlier implementation report](../artifacts/game-v2/REPORT.md)
for all real prompts, timings, screenshots, negative tests, restart evidence,
and known limits. The benchmark uses actual services, model requests, tools,
files, validation, and game windows, with fresh tutorial state and default
permissions. Input is simulated at the app level; physical macOS focus/input is
not certified by these tests. Unit tests separately cover paused timers,
permission boundaries, repairs, rollback, questions, previews, and failure UI.

Entrypoints: `runner-tutorial.ts` owns state/snapshots; `reactive-chat.ts` owns
turn/repair ordering; PiHarness/runtime own scoped tools; `theme-data.ts` owns
schema/patching; `browser-validator.ts` owns Chromium checks;
`RunnerGameView.tsx` owns preview labels; `SessionChatView.tsx` owns chat actions.

The service watchdog starts unavailable services immediately. For an established
service it requires three consecutive failed health probes before restarting, so
one delayed probe cannot interrupt a working model turn. Explicit Retry remains
immediate; failed health checks are still reported as disconnected.

Tutorial resume re-sends authorized state to chat and refreshes it when the composer receives focus. This covers an initial renderer state request arriving before restored authentication, so interruption/retry and publish controls remain visible after app reopen. Canonical sun/cloud/star decoration data is kept consistent with each rich scene preset; the schema limits night stars to 60.
