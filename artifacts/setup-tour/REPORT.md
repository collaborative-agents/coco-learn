# Coco first-run tour — implementation and verification

The existing login, account, permissions, voice, avatar and backend setup are retained. The interactive tour now follows that setup. Your normal account and history were preserved. The HTML prototype is a reference only; it is not imported, embedded, or used as the application. Production uses the existing game engine, theme tools, chat, fox assets and ObservationBubble design.

## 1. Account setup and connections

- First-run setup continues into Meet Coco → Play → Make it yours → Done. Accounts with outstanding required pre-assessments still complete them before receiving model access; those access checks were not bypassed.
- Tour progress is saved with the account’s game. Completed/skipped tours stay completed/skipped on restart and when creating another game. Existing games and every Undo version are preserved; the art migration also retains original snapshots.
- Play waits for both local services and real model probes to verify. Connection failures remain visible with Retry and an available Skip tour.
- The first game chat now registers its session with the authenticated backend before opening. This fixes the HTTP 404 message-sync errors observed when a seeded local conversation was resumed without a server session. Registration errors are shown and allow retry.
- During live verification, the project’s Python executable was missing and the local agent dependency import timed out. Restored the locked Python 3.12 environment and installed the pinned agent dependencies. Both packages import/load successfully. No additional API keys or permissions were added.

Verified by restoring your actual account into isolated test profiles and walking all original setup screens, without creating a new account or granting permissions. macOS permissions were already granted. After the tests, the **regular app** was inspected through its native UI: sensing and tutor both reported Connected (service) and Connected (model). Your regular tour is now in front, at Meet Coco, with Let’s play enabled.

[Original setup](verified/setup-0.png) · [Permissions](verified/setup-2.png) · [Avatar choice](verified/setup-4.png) · [Real service/model connections after reopening](finished-reopen/services-connected.png)

## 2. Tour and guidance

- Four-step navigation and Skip tour are available across the introduction, game, real chat and wrap-up.
- Meet Coco explains proactive tips and offers Why do you pop up? Tutorial tips use the existing blue/state-based ObservationBubble and an accessible ✕ close control.
- Make it yours unlocks after the first actual game over and pulses; the actions explain Go back / Tell Coco what to change / Finish when happy.
- Chat displays that Coco already has access to the game, preserves the three insertable suggestions, and shows the actual model’s understanding of the unsent draft. At most two draft tips are delivered.
- The real model shows its plan and tool progress. Coco explains that it is doing the work; the app’s actual validation drives the Testing it bubble. Details · Locked is retained.
- Published versions are labeled Updated by Coco and invite users to play and check the result. Looks good opens the three-habit wrap-up, then Finish setup completes the tour. No screenshot-upload task is part of this flow.

[Meet Coco](verified/01-meet-coco.png) · [Why pop-ups bubble](verified/01-why-popups.png) · [First game over](verified/03-game-over.png) · [Game chat](verified/04-chat.png) · [Real understanding check](verified/05-understanding.png) · [Actual plan and tool result](verified/suggested-daylight-chat.png) · [Wrap-up](verified/07-done.png) · [Wrap-up bubble](verified/07-done-bubble.png)

The fox and its bubble are separate native windows. Game/chat captures show those individual windows; companion screenshots are separate, not simulated overlays.

## 3. Art and honest publishing

- Extended the existing theme data with snowcap color/depth and a second forest layer with independent speed, size and density. Five parallax layers now combine mountains, hills, two forests and meadow details.
- Retained the existing detailed Coco/cat sprites, animated sky, grass, flowers, weather, particles, landing dust, hit flash, and matching time-of-day palettes and game-over cards.
- Theme validation now also catches the specific clear-daylight mismatch found during review: valid JSON that still uses night metadata, a moon or the automatic Moonlit title. It returns that diagnostic to the existing automatic repair loop. Explicit requests to retain night elements are respected.
- Cancelling/skipping during a check cannot publish a late result. Failure, repair and rollback remain real; no shell validation or fabricated approval/success state was added.

[Daylight with matching sun/title](daylight-repair/nov7-background.png) · [Flying](verified/flying.png) · [Cat in snowy night](verified/cat-snow.png) · [Undo to original](verified/06-undo.png)

## 4. Prompt results

**14/14 final cases passed. Median 9.25s; maximum 19.40s.** Each started from a fresh game with default real-user permissions. There were zero automatic approvals. The three suggestions and eleven typed prompts include vague, ambitious and misspelled requests and both previously failing November 7 daylight requests.

The first broad run published all 14, but visual review found that “only the background to daylight” retained a Moonlit title/moon. An instruction-only retest also failed the strengthened check. The final case below uses the semantic-validation/automatic-repair fix and took 19.4 seconds. The other thirteen results are from the preceding verified run; they were not falsely rerun or relabeled as a single post-fix batch.

| Prompt | Result | Time to publish | What changed | Evidence |
|---|---|---:|---|---|
| Change it to a daylight game! | Pass | 7.92s | day palette, sky and scenery; title: Sunny Run | [Screenshot](verified/suggested-daylight.png) |
| Make a flying version, so I can fly, not just jump. | Pass | 8.09s | hold-to-fly / release-to-fall behavior | [Screenshot](verified/flying.png) |
| Make the fox a cat running through a snowy night. | Pass | 13.47s | runner: Cat; snow weather | [Screenshot](verified/cat-snow.png) |
| change the background to daylight | Pass | 10.38s | day palette, sky and scenery; title: Sunny Meadow | [Screenshot](verified/daylight.png) |
| I want to make coco run in a daylight theme, but not a moon light | Pass | 8.61s | day palette, sky and scenery; title: Sunlit Meadow | [Screenshot](verified/nov7-theme.png) |
| hmmm maybe change only the background to daylight ! | Pass | 19.4s | day palette, sky and scenery; title: Sunlit Meadow | [Screenshot](daylight-repair/nov7-background.png) |
| make it cuter | Pass | 9.67s | morning palette, sky and scenery; title: Coco's Cozy Morning; runner: Cat; obstacles: bone; none weather | [Screenshot](verified/cuter.png) |
| make the runner my dog and the obstacles bones | Pass | 9.59s | runner: Dog; obstacles: bone | [Screenshot](verified/dog-bones.png) |
| make it way harder | Pass | 10.73s | difficulty/physics | [Screenshot](verified/harder.png) |
| Make it a detailed daylight world with a cat | Pass | 8.44s | day palette, sky and scenery; title: Sunlit Meadow; runner: Cat | [Screenshot](verified/ambitious-cat.png) |
| make it sunset with orange skies and mountains | Pass | 7.96s | sunset palette, sky and scenery; title: Sunset Ridge | [Screenshot](verified/sunset.png) |
| chnge the bakgrond to daylite plz | Pass | 7.48s | day palette, sky and scenery; title: Sunny Run | [Screenshot](verified/misspelled-day.png) |
| can u make a lil cat runing in sno at nite | Pass | 8.91s | runner: Cat; snow weather | [Screenshot](verified/misspelled-cat-snow.png) |
| turn sounds off and change the score label to DISTANCE | Pass | 10.09s | DISTANCE score label; sounds off | [Screenshot](verified/score-sounds.png) |

[Machine-readable final results](final-results.json) · [Full-flow events](verified/events.json) · [Daylight repair events](daylight-repair/events.json)

## 5. Recovery, tests and limits

- Full flow passed: existing-account setup → connections → introduction → actual game over → chat → model understanding check → actual edit → updated game → Undo → another edit → wrap-up → Finish setup.
- Real flying input rose while held and fell on release (130.10 → 0 in the verified run).
- [Skip](skip/events.json) and [reopening after Skip](skip-reopen/events.json) passed. [Completed-tour reopen](finished-reopen/events.json) preserved completion and reverified both services/models.
- [Closing during a real run](interrupt/events.json) and [reopening/Retry](resume/events.json) passed. The original version and request survived, the UI explained the interruption, and Retry published a new custom version. [Interruption screenshot](resume/reopened-mid-run.png) · [Recovered game](resume/reopened-repaired.png).
- 115 focused tests passed, then the two added daylight regressions passed in the 22-test runner suite (117 distinct focused checks in total). 60 original-setup/Training navigation checks passed. The 32 App/ObservationBubble checks passed. Stale assertions for the removed Training entry and previous avatar wording were updated; a concurrent-load Training timeout passed on isolated rerun.
- All 32 real Chromium validation cases passed, including all authored palettes, actual flying behavior, and deliberate throwing/infinite hooks. [Results](browser-validation.json).
- TypeScript, development build and full production build passed. This is not a claim that the entire repository’s test suite was run.

**Limits:** No synthetic “Not now” dialog exists: the required browser validator remains approval-free as agreed. Pending-approval timer pauses and declining an optional command without blocking a valid theme publish were verified in regression tests, not by inventing a live approval. A brand-new study account with outstanding pre-assessments was not created; live tests used your existing account, as requested. Its access restrictions remain intact. Screenshots and structural assertions do not constitute exhaustive subjective art review for every possible prompt.

Earlier environment failures, stale-iframe capture attempts, and the instruction-only daylight failure are retained in `startup-environment-failure/`, `agent-environment-failure/`, `live/`, and `daylight-recheck/`. The frame capture issue was corrected by waiting for the replacement iframe to be ready; the full Undo/replay flow subsequently passed. No known failure remains in the flows listed as passed above.
