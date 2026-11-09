# Check my understanding: diagnosis and fix

## What happened

In the game onboarding, an unsent draft takes a special read-only route. The model interpreted the draft, but the main process only sent its answer to the floating avatar bubble and returned `success: true` to chat. The chat handler displayed nothing on success. A hidden, obscured or offscreen bubble therefore made a successful check look like a dead button. With an empty draft, the same button fell through to a different feature: the conversation-recap quiz. The tooltip repeated the button label without explaining the purpose.

The card's green palette also differed from Coco. Its Start Task button lost its blue background on hover because a more specific generic Training hover rule overrode it while its text remained white.

Current runtime logs independently showed no executable in `.venv`. After repairing the environment, Python's missing default CA store prevented model checks. Both problems were reproduced and corrected; the earlier failing live attempt is preserved at `../understanding-check-tls-attempt/`.

## Changes

- An onboarding note explains that Check my understanding repeats the unsent game idea back before Send applies a change.
- The backend returns the actual interpretation to chat, which displays it inline as “Did Coco get your idea?” The existing avatar guidance remains available.
- The draft is preserved; this check neither submits a chat edit nor changes the game. Editing the draft hides the previous interpretation so it cannot be mistaken for a check of the new wording.
- An empty game draft gets a clear instruction to write an idea first. The normal conversation quiz remains available outside the game draft flow.
- Checking has visible progress. Missing/failed replies show an alert; the local service check fails promptly, the model request is bounded to 35 seconds, and the renderer has a 40-second fallback.
- Play with Coco uses the shared blue accent, border, type and button colors. Start Task explains that it opens a separate game window. Specific normal/hover rules preserve readable white text on dark blue; keyboard focus has a visible outline.
- Repaired the existing Python environment with `uv venv --allow-existing` and `uv sync --frozen`, preserving its existing files. Coco now supplies its installed certifi CA bundle when no explicit `SSL_CERT_FILE` exists. Certificate verification stays enabled, and an explicit trust configuration is preserved.

## Real verification

The isolated Electron test used real account/model configuration, services, model requests, workspace files and Chromium rendering. It copied no game history, chats or permission grants. It never answered an approval prompt.

| Check | Result |
|---|---|
| Both services and actual text/image model checks | Verified before the test |
| Empty onboarding draft | Visible instruction; no model check submitted |
| Real idea check | Reply visible in chat in 5.835s |
| Avatar hidden | Inline reply still visible |
| Unsent draft | Preserved exactly |
| Game version and theme/behavior hashes | Unchanged |
| Isolated tutor stopped | Specific error visible in 0.404s |
| Start Task normal contrast | 9.06:1 |
| Start Task actual Chromium hover contrast | 11.03:1 |
| Focused Jest suites | 44 tests passed |
| TypeScript check | Passed |
| Production build | Typecheck, main and renderer bundles passed |

[Blue card](01-blue-card.png) · [Hovered button](02-start-hover.png) · [Before checking](03-before-check.png) · [Actual reply with avatar hidden](04-result-without-avatar.png) · [Offline tutor error](05-tutor-offline.png) · [Raw results](results.json).

The offline test terminates only the tutor whose parent is the isolated Electron process, on its dedicated test port. It does not stop the normal user's service. Input in this test is app-level renderer/Chromium input; it does not certify physical macOS focus behavior.

Source: `desktop/tests/understanding-check.e2e.cjs`. Focused regression tests cover hidden-avatar-independent rendering, empty/missing/failed responses, preserving the draft, hiding stale interpretations, and CA bundle selection/explicit overrides. The full repository Jest suite was not rerun for this change; earlier documented unrelated failures are not represented as fixed.
