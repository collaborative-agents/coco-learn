# Coco bug fixes and verification — November 7, 2026

The requested onboarding path passed with real local services, real hosted model requests, and real agent file edits. Production builds and 104 targeted desktop tests passed. The full-suite run was not green; failures are listed below.

## 1. Services and model health

**Reproduction/root cause.** Development launch used `uv run python`, which was stuck reading cloud-offloaded project manifests. Some Python source files were also offloaded. Earlier launches also reported a missing proactive_tutor module; these launch paths now receive explicit workspace import paths. Initial chat health could run before authentication restoration and then retain a stale unavailable state. Model probes inherited dependency resolution/heavy initialization and had a 60-second outer wait.

**Fix.** Launch the installed `.venv` interpreter directly, supply workspace Python paths, and keep model probes lightweight. A service supervisor probes the actual HTTP endpoints, automatically starts/retries unhealthy services, and stops intentionally disabled services from being restarted. Failed model assessments are only briefly cached. Settings and onboarding expose connection errors and Retry. Router probes use one request with an eight-second network timeout and a fifteen-second hard process limit.

Unchanged offloaded source files were recovered from indexed Git blobs only after matching indexed size and timestamp. Offloaded dependencies were restored from exact locked npm packages. Original placeholders were retained in `.venv/cloud-source-backup`; user edits were not overwritten.

**Verified.** Both service identities and model assessments were healthy after fresh process launch and after reopening. Real text requests and a real 32×32 image request passed. Each test-owned service was killed separately; sensing recovered in 1.9 seconds and tutor in 2.8 seconds. A deliberately unresponsive model endpoint failed in [8.06 seconds](model-timeout.json). [Recovery events](reopen/events.json) and [live model probe results](bug1-model-probes.json).

## 2. First bubble and chat visibility

**Reproduction/root cause.** The tutorial guide branch omitted its pointer callbacks, leaving the companion window click-through. In Menu bar only mode, the avatar ready callback could hide a newly requested guide; guide events could also arrive before renderer listeners. I reproduced the noninteractive/hidden guide. The exact reported chat-disappearing action was not independently observed before repairing those prerequisites.

**Fix.** Reuse ObservationBubble’s pointer handling for tutorial guides, retain an active guide through renderer readiness, and show teaching windows without taking focus. Action failures remain visible in the bubble.

**Verified.** Real renderer pointer IPC enabled bubble interaction; Try it executed through the real IPC route with chat visible before and after. [Passing evidence](bug2-verified/events.json). The guide keeps the existing ObservationBubble styling.

## 3. Try it and gameplay

**Reproduction/root cause.** Try it only focused chat and displayed instructions. No native game window opened. The inline preview could run independently of the intended play action.

**Fix.** Try it has an explicit play action that opens the actual game window. The inline preview starts paused; only the playable window advances tutorial progress. The sandbox frame focuses its canvas for controls.

**Verified.** The old handler failed the game-window assertion. The fixed handler opened the actual game; a Space event moved the rendered fox from y=288 to y=200. A real collision produced Make it yours. No synthetic game-over message was used.

## 4. Make it yours and real customization

**Reproduction/root cause.** Once the bubble defects were repaired, the button reached the empty composer and selected workspace. The live agent then stalled importing cloud-offloaded dependencies. After dependency repair, a real DeepSeek turn read files, used its 8,192 output tokens, and ended with whitespace and no edit. The bridge discarded provider finish reasons and could present this as normal completion.

**Fix.** Repair exact locked dependencies and preflight native ESM loading in a killable process, keeping a stuck file import off Electron’s UI thread. Send an explicit DeepSeek thinking-off setting to match the SDK’s mode. Empty model turns and truncated replies produce errors; provider finish reasons are preserved. Independent game validation rejects unchanged or invalid candidates and exposes validation diagnostics. Legacy activities are checked against their own stable core, so an app update does not invalidate untouched older game files. Coaching invites the user’s own idea; the result bubble describes categories of files actually changed.

DeepSeek’s official thinking controls are documented in its [API guide](https://api-docs.deepseek.com/guides/thinking_mode/). The observed empty turn and later successful edit are recorded separately; model latency is not assumed from documentation.

**Verified.** A real unsent draft produced coaching, then a real model interpretation without losing the draft. Sending it produced streamed tool activity, actual theme/render edits, a successful workspace check, independent validation, and a new immutable version. The sunny game visibly animated, then Looks good and Continue completed the activity. The selected model remained DeepSeek; no provider response, service, edit, or success state was mocked.

## Screenshots for each step

| Step | Evidence |
|---|---|
| Launch → services and models connect | [Health](final/01-services-connected.png) |
| Initial game preview | [Preview](final/02-base-game.png) |
| Coco introduction | [First bubble](final/03-first-bubble.png) |
| Try it → playable game | [Game window](final/03b-playable-game.png) |
| Keyboard jump | [Jump](final/03c-keyboard-jump.png) |
| Actual game over → invitation | [Make it yours](final/04-game-over-invitation.png) |
| Empty agent composer/workspace | [Composer](final/05-empty-agent-composer.png) |
| Own prompt and typing coach | [Draft](final/06-own-prompt.png), [coach](final/06b-draft-coaching.png) |
| Model checks the unsent idea | [Interpretation](final/06c-understanding-check.png) |
| Agent starts working | [Working](final/07-agent-working.png) |
| Real tools and resulting explanation | [Agent result](final/08c-agent-result.png) |
| Actual custom game | [Sunny game](final/08-custom-game.png) |
| Coco describes the change | [Result bubble](final/08b-custom-game-bubble.png) |
| Wrap-up and return | [Wrap-up](final/09-wrap-up.png), [return](final/10-training-complete.png) |
| Quit/relaunch preserves custom game | [Restored game](reopen/11-restored-custom-game.png) |
| Close/reopen chat | [Reopened chat](reopen/12-chat-reopened.png) |

[Full walkthrough event log](final/events.json). [Relaunch and recovery log](reopen/events.json).

## Test scope, remaining issues, and user setup

- **Passed:** 104 targeted desktop tests in 12 suites; 22 Python bridge/provider tests (one integration test skipped); TypeScript and production main/renderer builds; the real walkthrough and reopen/recovery checks. A legacy-activity regression failed before its fix and passed afterward.
- **Full desktop suite:** the broad run had 770 passes and seven failures. Its health Retry assertion was subsequently updated and passed with the targeted tests. Six assertions in five other files remain failing: ChatComparison (skill unlock fixture), OnboardingView (two menu-bar copy assertions), ToolTrainingBanner (chapter copy), DesktopTheme (CSS token versus numeric height), and TutorModelPicker (old unlock-link expectation). They have not been rewritten or treated as passes.
- **Latency:** the successful build took about 110 seconds from Send to publication, exceeding the earlier 45-second target. Progress and the working previous game remain available. This is a measured limitation.
- **Input scope:** Electron windows, IPC, sandbox rendering, services, models, and agent tools were real. Input was programmatic. Companion input and keyboard input used DOM events when macOS did not grant native focus to the test instance. Physical mouse/keyboard interaction across macOS focus changes still needs a manual check. Morning-scene customization was tested live; arbitrary art styles and pet replacements were not each tested live.
- **Your setup:** no new API key is needed for the tested signed-in Router account; its model access worked. Keep the project downloaded or move the checkout out of cloud-managed Documents so source/dependency files cannot be offloaded again. Development requires the existing `.venv` (`uv sync` once if missing) and installed desktop dependencies. Errors now identify missing environments or local agent dependencies instead of silently completing.
- Verification used an isolated app-data directory with the existing account/model configuration. Your normal app data and conversations were not reset. The normal development app and its renderer server remain running.

## Follow-up: visible customization entry

Make it yours is permanently visible above the training game and in the native game window’s top bar. It opens the actual workspace/composer before game over. Reopening editing preserves existing conversation data and the unsent draft. Verified with the real Electron app ([events](direct-entry/events.json), [visible button](direct-entry/02-base-game.png), [composer](direct-entry/direct-edit-composer.png), [preserved draft](direct-entry/retained-edit-draft.png)); 45 related tests and TypeScript passed.
