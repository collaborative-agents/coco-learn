# Optional pre-assessment Task 1 v3

Adds a download card beneath the existing Part A/E question panel, using the
same Training UI styling. It is independent of question scores/completion and
the seven-day training unlock rules. Task instructions are distributed separately.

The card appears only when `/api/study/me` advertises an available
`evaluation_tasks` entry with `task: 3`. Old servers and unregistered materials
leave the current UI unchanged. The main process downloads the ZIP using the
authenticated `/api/study/evaluation/pre/3/download` endpoint, then uses a native
Save dialog. No credentials or public file URLs are exposed to the renderer.

Requires the companion monorepo backend PR and approved private ZIP registration.
No task files are embedded in this PR/package. This PR does not deploy a server,
register materials, change existing questions, or release an app. If the task is
rejected, simply close the PRs with no production impact.
