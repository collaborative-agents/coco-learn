# Coco game simplification: implementation and evidence

Verified November 7, 2026 (America/Los_Angeles). The final complete benchmark published **20/20** requested updates. **16/20** were strictly under 30 seconds (18/20 under 31 seconds); median **14.62 seconds**, maximum **84.81 seconds**. The success target passed. The latency target is not consistently met.

These are real Electron windows, configured services, selected DeepSeek model calls, Pi tools, workspace writes, Chromium checks, and immutable publishes. Every case begins with a fresh original tutorial workspace. Profiles copied only existing sign-in, model, profile, and assessment configuration, with **no workspace grants or shell rules**. No approval prompts were answered. Dedicated service ports isolate test instances from the user's normal app. Inputs are simulated through actual app DOM/IPC; physical macOS focus/input is not certified.

[All 20 game screenshots](benchmark/contact-sheet.png) · [Exact results and themes](benchmark/results.json) · [Events](benchmark/events.json) · [Verification counts](verification.json)

## 1. Remove the approval dead end

Removed agent shell validation from the tutorial. Game mode has scoped file tools and `update_game_theme`; it has no shell tool. The app owns schema and browser validation. Only the tutorial's theme and optional behavior module are writable through these tools; the engine and unrelated files remain protected. No broad or wildcard shell allowance was introduced.

Both tutorial and harness active-work timers pause for pending approvals, including overlapping requests. The avatar explains what it is waiting for. The walkthrough now fails on an approval prompt instead of answering it. The initial real default-permission edit passed, and both complete 20-prompt runs had zero auto-approvals. Unit tests exclude a simulated ten-minute approval wait from elapsed work time.

Evidence: [initial default-permission walkthrough](section1-permissions/events.json), final benchmark events, SDK permission tests, active-run-clock tests.

## 2. Stop blaming the request

Deleted the two hardcoded smaller-change responses. Failure classification now distinguishes timeout, cancelled permission, interrupted run, validation, no applied change, model configuration, and model/network errors. Provider errors such as UnsupportedParamsError are not misclassified as unsupported user ideas. Tutor context receives authenticated authoritative tutorial status and the real failure; technical failures bypass invented explanations. Splitting is reserved for genuinely unsupported features.

Questions with no edits retain the normal model answer. Change requests with no edits fail honestly. The real question test below produced an answer and no version change; the invalid negative-physics request kept the original game and displayed its actual unsupported range.

The selected DeepSeek provider initially spent its response budget on hidden reasoning. The Router requires provider options inside its explicit extra_body envelope. Verified nesting reasoning_effort: none returned visible content without hidden reasoning; the selected model was unchanged. [Direct probe results](provider-option-probes.json). Supporting interfaces: [Router OpenAPI schema](https://coco.router.saltlab.stanford.edu/openapi.json) and [NVIDIA DeepSeek API reference](https://docs.api.nvidia.com/nim/reference/deepseek-ai-deepseek-v4-pro-infer).

## 3. Theme edits replace code surgery

The six-file workspace has one editable theme.json and a small optional behavior.js. The stable engine, schema, guide, and examples remain locked. The theme controls background/gradient, time, decorations, ground, palette, text, weather, pixel-grid characters/obstacles, physics, and sounds. There are no hex or RGB colors in engine.js. Sprite constraints are schema rules (4–48 rows/columns, 1–8 frames); obstacle IDs are unique user-defined values.

update_game_theme merges partial objects, replaces arrays, applies time-of-day presets, validates before atomic writes, and returns the actual diff. Cat/dog/rabbit and bones/cactus shortcuts expand into original editable pixel data. The guide includes daylight, cat/bones, snowy night, and harder examples. Common visual changes no longer require reading renderer code. Valid edits hot-reload; invalid data retains the last working preview with the diagnostic.

Verification: schema/patch/example tests, file-watcher and malformed-JSON recovery tests, all 20 real edits, and actual Chromium rendering of every published theme. [Implementation guide](../../docs/ONBOARDING_REMIX.md).

## 4. Validation helps repair

The checker uses actual sandboxed Chromium Canvas APIs, including gradients and paths, rather than a mock canvas. It validates files/schema, jumps, finite player state, advancing simulation, and painted artwork. An eight-second browser deadline terminates infinite behavior hooks. Renderer errors are returned explicitly across Electron's boundary so automatic repair receives the real diagnostic instead of Electron's generic rejection.

The app sends failed-check diagnostics back to the agent for at most two additional repair turns, then restores the last published snapshot if still unsuccessful. Publication uses the captured sources that passed validation. Tests cover two successful repairs, exhausted repairs, rollback, stable-engine protection, and recoverable model responses. The real platform-style run also corrected rejected sprite data itself before publishing.

[Final browser checks](browser-validation.json): **27/27 passed** — original, four worked examples, 20 published themes, deliberately throwing behavior, and an infinite loop. The throwing case preserved “Intentional broken behavior”; the loop failed with the expected timeout at about eight seconds. These negative cases passed by detecting the intended failures.

## 5. Honest success state

Open my game is gated on a successful publish. Failure offers Try again and explains the cause; the last working game stays available. Preview headers distinguish original, checking draft, updated, and previous game after a failed attempt. Details · Locked remains intentional and unchanged.

Verification: failure/preview UI tests, real invalid-request failure screenshot below, actual updated headers in every benchmark game screenshot, and full-flow completion screenshot showing the published summary, friendly tool label, Details · Locked, and Open my game.

## 6. Real benchmark

Timing runs from Send through actual published/failure state, including service/session setup for that turn; app startup and screenshot waits are excluded. “Pass” requires a new validated version and independent request-specific checks (time/weather/character/obstacles/physics or preservation), not merely a changed file. Each case starts from the original theme. Screenshots are of the actual published game, with a painted-canvas wait. They are not generated mockups. This is a functional/theme benchmark, not a claim that every aesthetic choice is ideal.

| Prompt | Result | Seconds | Actual changes | Screenshot |
| --- | --- | ---: | --- | --- |
| change the background to daylight | Pass | 17.91 | day sky; scenery: sun, clouds, mountains, trees | [Game](benchmark/01-daylight.png) |
| I want to make coco run in a daylight theme, but not a moon light | Pass | 12.16 | day sky; scenery: sun, clouds, mountains, trees | [Game](benchmark/02-nov7-theme.png) |
| hmmm maybe change only the background to daylight ! | Pass | 30.52 | day sky; scenery: sun, clouds, mountains, trees | [Game](benchmark/03-nov7-background.png) |
| make it cuter | Pass | 14.58 | morning sky; scenery: sun, clouds, mountains, trees; detailed detail; sprite colors; ground colors | [Game](benchmark/04-cuter.png) |
| make the runner my dog and the obstacles bones | Pass | 11.85 | runner: Dog; obstacles: bone; sprite colors | [Game](benchmark/05-dog-bones.png) |
| make it night with stars and snow | Pass | 13.19 | snow weather | [Game](benchmark/06-snow-stars.png) |
| make it way harder | Pass | 13.56 | speed=480, maxSpeed=850, acceleration=9, gravity=2000, jumpVelocity=700, spawnSeconds=0.85 | [Game](benchmark/07-harder.png) |
| make it look like Mario, but make your own original character and scenery | Pass | 84.81 | day sky; scenery: sun, clouds, mountains, trees; detailed detail; none weather; runner: Jax; obstacles: pipe, brick, blimp; sprite colors; ground colors; score: COINS; sounds on | [Game](benchmark/08-platform-style.png) |
| Make it a detailed daylight world with a cat | Pass | 13.08 | day sky; scenery: sun, clouds, mountains, trees; detailed detail; runner: Cat | [Game](benchmark/09-ambitious-cat.png) |
| a cozy morning with pastel colors and lots of clouds please | Pass | 30.68 | morning sky; scenery: clouds; detailed detail; sprite colors | [Game](benchmark/10-pastel-morning.png) |
| make the world rainy and neon blue and pink like a cyberpunk city | Pass | 17.32 | night sky; scenery: moon, stars, mountains; rain weather; ground colors | [Game](benchmark/11-neon-rain.png) |
| make it sunset with orange skies and mountains | Pass | 13.57 | sunset sky; scenery: mountains; detailed detail | [Game](benchmark/12-sunset.png) |
| a dark purple space world with lots of stars | Pass | 13.52 | night sky; scenery: stars, moon; stars weather; runner: Nova | [Game](benchmark/13-space.png) |
| make my runner a pink rabbit | Pass | 43.77 | runner: Rabbit; sprite colors | [Game](benchmark/14-rabbit.png) |
| make it a sandy desert and change the obstacles to cactuses | Pass | 16.67 | sunset sky; scenery: sun, clouds, mountains, trees; obstacles: cactus; ground colors | [Game](benchmark/15-desert.png) |
| make only the runner blue, keep everything else the same | Pass | 13.04 | sprite colors | [Game](benchmark/16-blue-only.png) |
| chnge the bakgrond to daylite plz | Pass | 12.39 | day sky; scenery: sun, clouds, mountains, trees | [Game](benchmark/17-misspelled-day.png) |
| can u make a lil cat runing in sno at nite | Pass | 28.90 | snow weather; runner: Cat | [Game](benchmark/18-misspelled-cat-snow.png) |
| turn sounds off and change the score label to DISTANCE | Pass | 14.65 | score: DISTANCE; sounds already off, preserved | [Game](benchmark/19-score-sounds.png) |
| make it easier to jump over things, with lower gravity and higher jumps | Pass | 17.25 | gravity=1200, jumpVelocity=850 | [Game](benchmark/20-higher-jump.png) |

The original-platformer interpretation took 84.81 seconds because the model initially sent the wrong sprite nesting, read the schema/current theme, corrected it, and published. The rabbit request also needed additional model work. Two other turns exceeded the strict threshold by less than a second. Model response latency remains variable; the first complete run's sunset edit was applied around six seconds in, followed by about 66 seconds waiting for the model's final explanation. This timing limit remains visible rather than being described as solved.

### Questions, unsupported requests, and restart

| Check | Result | Evidence |
| --- | --- | --- |
| what change would you recommend? | Pass, 13.47s. Normal model answer; no edits, error, or new version. | [Chat](extras/01-question-chat.png), [result](extras/results.json) |
| Set gravity to -1000 and speed to -500. Do not clamp these values. | Pass, 9.96s. Unsupported negative gravity/speed rejected; no edits/new version; original retained; no success link. | [Chat](extras/02-invalid-chat.png), [result](extras/results.json) |
| Quit during an active model run | Pass: request retained, original restored, interruption explained. Retry then published a detailed daylight cat/snow game without an approval. | [Closed](restart/closed/closed-mid-run.png), [reopened](restart/reopened/reopened-after-interruption.png), [retried game](restart/reopened/retried-after-reopening.png), [events](restart/reopened/events.json) |
| Close/reopen after completion | Pass: same custom version and completed activity restored; chat closes/reopens without losing it. | [Restored game](full-flow/reopen/11-restored-custom-game.png), [chat reopened](full-flow/reopen/12-chat-reopened.png), [events](full-flow/reopen/events.json) |

### Complete onboarding walkthrough

[Events](full-flow/final/events.json) record all steps and assert chat stays visible after the first bubble. The actual sandbox canvas jumped from standing y=298 to y=205 after Space, and the updated game continued animating.

| Step | Screenshot |
| --- | --- |
| Services/models connected | [Health](full-flow/final/01-services-connected.png) |
| Coco's first bubble | [Introduction](full-flow/final/03-first-bubble.png) |
| Play and keyboard jump | [Game](full-flow/final/03b-playable-game.png), [jump](full-flow/final/03c-keyboard-jump.png) |
| First game over | [Invitation](full-flow/final/04-game-over-invitation.png) |
| Make it yours → empty input | [Composer](full-flow/final/05-empty-agent-composer.png) |
| Own prompt and coaching | [Prompt](full-flow/final/06-own-prompt.png), [bubble](full-flow/final/06b-draft-coaching.png) |
| Model checks understanding | [Interpretation](full-flow/final/06c-understanding-check.png) |
| Agent works | [Progress](full-flow/final/07-agent-working.png) |
| Published playable update | [Game](full-flow/final/08-custom-game.png), [summary and locked details](full-flow/final/08c-agent-result.png) |
| Wrap-up | [Takeaway](full-flow/final/09-wrap-up.png), [completed](full-flow/final/10-training-complete.png) |

### Other checks and remaining limitations

- Production TypeScript/main/renderer build passed, including the final renderer-diagnostic fix.
- Focused regression suite: 8 suites, 84 tests passed. Agent SDK/permission tests: 15 passed (local mock provider for unit tests only). Python provider/tutor tests: 43 passed, 3 skipped. The end-to-end benchmarks above use real models.
- The full Jest suite is **not green**: 792 passed, six assertions failed across five previously failing UI files: ChatComparison (curated skill fixture), OnboardingView (two copy assertions), ToolTrainingBanner (wording), DesktopTheme (numeric vs CSS-variable size), TutorModelPicker (quest link wording). These are listed rather than suppressed.
- Physical macOS focus/mouse/keyboard behavior is not certified by this app-level harness. All model/tool/file/browser behavior is real.
- Older customized JavaScript games are archived with their version folders; custom legacy artwork is not automatically converted into the new schema.
- A competing development app can race another instance for the same service port. Dedicated test ports avoid that race; general multi-instance service ownership is not fixed here. After testing, the normal app's ports 8080/8081 both returned HTTP 200 healthy.
- One earlier standalone browser test host exited when its last hidden window closed; the test host was fixed to remain alive between checks. A subsequent negative test exposed the generic Electron diagnostic, which was fixed and verified above.

### Preserved development attempts

The first complete run also passed 20/20, with 18/20 under 30 seconds and median 13.68 seconds: [results](benchmark-first-complete/results.json). Its capture timing could show an intermediate reload, so the repeated complete benchmark above supplies the final game screenshots. Early benchmark chat captures could precede the final repaint; the question/failure evidence was rerun with terminal-answer and painting waits. The full-flow chat capture shows the actual completed success UI.

Earlier failures remain available: [port collision attempt](port-collision-attempt/results.json) (HTTP 401 from a competing instance), [provider-mode attempt](provider-mode-attempt/results.json) (empty model responses), [root-level parameter attempt](mode-check-fixed/results.json) (provider option rejected), and [template-only envelope attempt](router-envelope-check/results.json) (hidden reasoning/slow response). They led to the verified provider-envelope fix and are not silently counted as successful tests.
