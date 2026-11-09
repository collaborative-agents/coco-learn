# Coco Health connection fix

## Reproduction

A fresh app process restored account policy before it finished obtaining the shared model-router credential. Coco Health could run in that interval. It fell through to direct-provider validation and reported “Anthropic requires an API key” and “DeepSeek requires an API key,” while the services had not started yet. This was reproduced with the current account/model configuration; [before results](../coco-health-startup-race-before/results.json) are retained.

A separate regression reproduced an older failed request replacing a newer successful health result. The regression failed before the request-revision fix.

## Changes

- Health reports **Connecting… (model)** while a configured router is still obtaining its account credential. This state is not cached as failure and does not run direct-provider key validation.
- A service waiting for sign-in is labeled **Starting… (service)**. A detected wrong service/occupied port remains an error.
- The Health page rechecks every two seconds while model access or a local service is still coming up, then returns to the existing normal polling interval. Retry remains available for actual failures; startup progress prevents premature restart attempts.
- Only the most recent request can update the result, error or loading state. Existing sleep-mode guards remain active.
- No account eligibility checks or permissions were relaxed. No first-run tour or prototype implementation was changed.

## Verification

The final isolated cold launch recorded starting/connecting, followed by both actual services and models verified in **9.648 seconds**. The sensing model accepted text and a generated test image; the tutor accepted text. Coco Health displayed both green service/model rows automatically, without manually pressing Retry. These are actual model calls, not mocked success results. Existing sign-in/model configuration was used; no provider keys or approval grants were added.

- 46 focused Jest tests passed across chat health, Python environment and model-probe suites.
- The two new UI regressions cover out-of-order responses and credential → local-service → fully-connected startup transitions.
- TypeScript and the development main build passed.
- The new onboarding plan is still awaiting the requested go-ahead. Its separate pre-assessment eligibility dependency is unchanged.

[Startup screenshot](startup-health.png) · [Connected screenshot](health.png) · [Raw live results](results.json).
