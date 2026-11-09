# Coco game visual preview source

The user approved this visual checkpoint. Its page and renderer have been promoted
to desktop/src/renderer/components/getting-started/GamePage.* and
 desktop/src/main/game/engine.js. The live theme/schema/presets are under that game
directory. The production version adds the native floating avatar, authenticated
session flow, prompt suggestions, and real flying behavior.

This folder remains a standalone visual preview builder. It does not replace the
app entrypoint. Build with `node desktop/design/game-polish/build.cjs`; run
capture.cjs with the local Electron to reproduce static palette/layout review
frames. Those fixtures are not claims of model-published edits.

Final live evidence and scope: artifacts/game-polish/REPORT.md.
