# Coco game polish and training-flow verification

Implemented the approved light Coco game page and richer theme-driven pixel art, with the requested clearer Coco and cat sprites.

## What changed and how it was checked

1. **Recognizable characters and richer art.** Coco has large pointed ears, cream cheeks, shaded orange fur, a bushy cream-tipped tail, and running frames. The cat has a thin curled tail, whiskers, and forehead markings. Four independent parallax layers, animated sky/grass/particles, textured ground, landing dust, hit flash, and matching game-over cards remain theme data. Morning/day/sunset/night presets repaint the whole scene and set matching titles. Real Chromium checks cover all four palettes and validate the sprite grids; the live cat/night/snow result is shown below.
2. **Coco presentation.** The approved rounded game card, airy background, shared typography/colors, pill controls and a single primary action are integrated into production. Guidance uses the real native fox and existing ObservationBubble component, including its existing state colors; it does not force orange bubbles. :codex-annotation{index="1"} The avatar is positioned clear of the controls and its previous desktop position is restored afterward.
3. **Start Task → play → chat → build → replay.** Start Task opens a separate native game window immediately. The two requested intro/play bubbles are protected from unsolicited-coaching suppression. Make it yours opens the owned workspace and an empty composer with “What do you want to change about your game?” Three suggestions insert text without sending; copy preserves the draft. Existing proactive typing tips remain active. Real-model runs verified publishing, replay, Looks good, and completion.
4. **Actual flying mechanics.** The scoped `behaviorPreset: flight` call installs a small behavior module with hold-to-rise/release-to-fall input. The engine exposes held input, clears it on blur/cancel/pause, and provides keyboard and pointer Fly/Descend controls. The engine stays protected. A controls label alone is explicitly rejected by browser validation. Live tests verified both keyboard and trusted Chromium pointer input.
5. **Reliable, honest operation.** In-process browser validation and automatic repairs remain approval-free inside this tutorial. Details · Locked remains intact. Failed drafts do not become published success. Visual migration preserves existing custom games, history, physics, scores, and undo. The original preview is correctly labeled after undo. Established services require three consecutive failed probes before recovery, so a single slow health request does not terminate a working model turn. Explicit Retry and first launch remain immediate. Canonical sun/cloud/star decoration data now matches all four authored scene palettes; regression checks prevent legacy night decorations overriding day. A background-only summary now says “updated the sky and scenery” instead of assuming a time of day from unchanged metadata.

## Final live suggested-prompt runs

All three start from the original game with default real-user permissions. No approval prompts are answered automatically. These use real service/model requests, scoped tool calls, actual workspace edits, Chromium validation and publishing.

| Prompt | Result | Time to publish | Evidence |
|---|---|---:|---|
| Change it to a daylight game! | Pass | 14.50s | [Game + Coco](live/1-game-with-coco.png) · [Agent](live/1-agent-result.png) |
| Make a flying version, so I can fly, not just jump. | Pass | 8.66s | [Game + Coco](live/2-game-with-coco.png) · [Agent](live/2-agent-result.png) |
| Make the fox a cat running through a snowy night. | Pass | 10.02s | [Game + Coco](live/3-game-with-coco.png) · [Agent](live/3-agent-result.png) |

The flying run rose to y=141.40 with the keyboard held and fell to y=0 after release. Trusted Chromium pointer input on Fly rose to y=141.46 and returned to y=0. Blur cleared held input. See [held](live/05-flying-held.png), [released](live/05-flying-released.png), and the [raw events](live/events.json).

[Short flying replay](flying.gif) uses the actual model-published engine/theme/behavior snapshot, real keyboard handlers, and ordinary animation frames. It does not directly move the player or manually step the simulation. [Frame metadata](flight-replay/recording.json) records the hold/release trajectory. It is a replay of the published version, not a recording of the model working.

The three `game-with-coco.png` images combine captures of the actual separate game, avatar and speech-bubble native windows at their measured relative bounds. They are explicitly composited evidence, not single-window captures or mockups. Raw game/avatar/bubble images and native bounds remain in `live/`.

## Whole-session screenshots

- [Start Task / native game](live/01-native-game.png)
- [First introduction](live/02-introduction.png) and [fox](live/02-avatar.png)
- [Actual game over](live/03-game-over.png) and [remix invitation](live/03-remix-invitation.png)
- [Chat greeting and three suggestions](live/04-chat-and-suggestions.png)
- [Inserted prompt](live/1-prompt-inserted.png), [working agent](live/1-agent-working.png), [updated daylight game](live/1-updated-game.png)
- [Updated flying game](live/2-updated-game.png)
- [Updated cat in snowy night](live/3-game-with-coco.png)
- [Wrap-up](live/06-wrap-up.png) and [completed session](live/07-completed.png)
- [Completed custom game restored after app reopen](reopen/restored-custom-game.png)

## Broader prompt regression

All 20 cases published validated games and passed their recorded structural assertions. Median time was **11.545 seconds**, **19/20 finished under 30 seconds**, and the slowest took **43.77 seconds**. Both November 7 daylight requests are included. [Every prompt, timing, changed field and screenshot](PROMPTS.md) · [contact sheet](benchmark-contact-sheet.png) · [raw results](benchmark/results.json).

Publication success is not a complete creative-quality score. Human review found that the platform-inspired case chose “Goomba Hop,” which does not satisfy an entirely original name. A background-only edit preserves time-of-day/title metadata unless those fields are also requested/updated; its previous misleading sky summary is fixed. These limits are not counted as silently perfect creative results. The final full session was repeated after palette/schema and resume fixes. The 20-case run preceded those refinements and the watchdog fix; some late screenshots preserve the real transient sensing warning. The final three live examples and explicit service recovery run use the corrected watchdog.

## Restart and recovery

- The completed cat/night/snow version and completion state survived a full app reopen with the same version ID. [Events](reopen/events.json).
- Both isolated services were deliberately terminated and restarted automatically: sensing in 10.47s and tutor in 11.59s. Both model checks were verified. [Health screenshot](service-recovery/01-services-connected.png) · [recovery events](service-recovery/events.json).
- Mid-run restart restored the original published version and the preserved request with an explicit interruption explanation. Clicking the real Retry control then published a new version and displayed that exact version in the native game window. [Before Retry](restart/fixed-reopened/reopened-after-interruption.png) · [Recovered game](restart/fixed-reopened/retried-after-reopening.png) · [Recovered chat](restart/fixed-reopened/retried-after-reopening-chat.png) · [Events](restart/fixed-reopened/events.json).
- Question-only request answered normally in 11.40s with no edits or version change. Invalid negative gravity/speed rejected in 5.02s with a specific unsupported-physics explanation, no edits, and no new version. [Results](extras/results.json) · [Question chat](extras/01-question-chat.png) · [Invalid request chat](extras/02-invalid-chat.png).

## Verification and remaining limits

- TypeScript checking and both production bundles passed. [Build output](checks/production-build.log).
- Final focused theme/chat suites: **51/51 passed**, including all four palette consistency checks, initial-before-sign-in state restoration, and background-only summary accuracy. [Output](checks/focused-tests.log).
- Final real Chromium checks: **32/32 passed**, including all examples/palettes, 20 earlier published themes, duck collision clearance, flight input, thrown diagnostics, and an 8-second infinite-loop rejection. [Results](browser-validation.json).
- Service-supervisor/TrainingView focused run: **53/53 passed**, including transient probe/reset behavior and explicit Retry. SDK/permission unit checks: **15/15 passed**.
- Full Jest run: **808 passed, 6 failed, 814 total; 130/135 suites passed** (79.174s). The remaining failures are the previously observed assertions in `ChatComparison` (curated-skill fixture), `TutorModelPicker` (quest-link wording), `OnboardingView` (two avatar-completion assertions), `ToolTrainingBanner` (locked-details assertion), and `DesktopTheme` (numeric versus CSS-variable typography). The suite is not green; these tests were retained. The native-window TrainingView checks pass in this idle full run. [Complete Jest output](checks/full-jest.log).

The last system-process inventory and repeated normal-service HTTP spot checks were **not executed**: automatic approval review could not complete because it hit a usage limit. The review did not determine the actions unsafe. Earlier normal-service checks returned HTTP 200; all owned live/reopen/replay runs reported completion. This does not affect the recorded isolated service-crash recovery test.

The end-to-end harness operates real Electron windows and IPC. Companion-window actions use real renderer events because companion windows deliberately cannot focus; flying additionally uses trusted Chromium pointer events. Physical macOS mouse/focus behavior has not been certified by these app-level tests.

No new API key was necessary with the existing signed-in profile. One repeat failed before services started because the gateway sign-in restore returned `TypeError: fetch failed`; the failed evidence is retained in `gateway-restore-attempt`. The current auth path clears the saved session on this failure, so a real user can need to sign in again after a transient gateway outage. This existing auth-recovery limitation remains; the final repeat using the same original credentials subsequently passed. Isolated runs copied sign-in/model/profile/preassessment configuration only, without permission grants. They do not modify the normal user profile. The normal local sensing/tutor endpoints both returned HTTP 200 after the recovery tests.

## Preserved failures and corrections

Earlier attempts remain on disk instead of being hidden: a null health-test payload (`launch-check-attempt`); startup guidance erased by proactive suppression (`bubble-startup-attempt`, fixed with a regression); a single missed health probe terminating a service under heavy parallel load (`service-restart-attempt`, fixed with three-probe recovery); and an unbounded capture hang (`capture-hang-attempt`, recorder now bounded). Restart testing also reproduced a real authentication timing race: the initial renderer tutorial-state request could fail before sign-in and never refresh, hiding tutorial-specific retry/publish controls. The composer now refreshes authorized state on focus and main re-sends it; a regression reproduces the initial failed request. Restart retries also exposed harness mistakes: looking only for “Try again” when the transcript has “Retry,” an intermediate 65-star night preset exceeding the legacy decoration limit (constrained to 60, with schema and browser checks then passing); and coupling publish confirmation to an iframe inspection that could stall. Those attempts are retained under `restart/`; publishing and preview evidence are checked separately in the final run.

Existing v2 saved games receive a non-destructive visual migration. Older legacy-v1 archives retain the earlier archive behavior; they are not silently represented as fully migrated v2 custom games.

Implementation/architecture: [ONBOARDING_REMIX.md](../../docs/ONBOARDING_REMIX.md). Machine-readable verification: [verification.json](verification.json).
