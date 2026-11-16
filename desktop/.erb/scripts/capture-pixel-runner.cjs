/* Capture real renderer frames without a browser, network, or UI automation. */
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS', moduleResolution: 'Node' },
});
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const {
  pixelConfig,
} = require('../../src/renderer/components/getting-started/pixel/config');
const {
  createRun,
  advanceRun,
  jump,
} = require('../../src/renderer/components/getting-started/pixel/behavior');
const {
  renderRun,
} = require('../../src/renderer/components/getting-started/pixel/render');
const output = process.argv[2] || '/private/tmp/coco-pixel-approval';
fs.mkdirSync(output, { recursive: true });
const canvas = createCanvas(pixelConfig.width, pixelConfig.height);
const ctx = canvas.getContext('2d');
const state = createRun(pixelConfig, 428, 42);
for (let i = 0; i < 420; i++) {
  const next = state.obstacles.find((o) => o.x > 120);
  state.ducking = Boolean(next?.kind === 'moth' && next.x < 310);
  if (next && next.kind !== 'moth' && next.x < 245 && next.x > 190)
    jump(state, pixelConfig);
  advanceRun(state, pixelConfig, 1 / 60);
}
renderRun(ctx, state, pixelConfig);
fs.writeFileSync(
  path.join(output, 'moonlit-run-play.png'),
  canvas.toBuffer('image/png'),
);
const frames = path.join(output, 'frames');
fs.mkdirSync(frames, { recursive: true });
for (let i = 0; i < 120; i++) {
  const next = state.obstacles.find((o) => o.x > 120);
  state.ducking = Boolean(next?.kind === 'moth' && next.x < 310);
  if (next && next.kind !== 'moth' && next.x < 245 && next.x > 190)
    jump(state, pixelConfig);
  advanceRun(state, pixelConfig, 1 / 30);
  renderRun(ctx, state, pixelConfig);
  fs.writeFileSync(
    path.join(frames, String(i).padStart(3, '0') + '.png'),
    canvas.toBuffer('image/png'),
  );
}
const end = createRun(pixelConfig, state.highScore);
end.obstacles = [{ x: 160, kind: 'stump' }];
advanceRun(end, pixelConfig, 1 / 60);
end.time += 1;
renderRun(ctx, end, pixelConfig);
fs.writeFileSync(
  path.join(output, 'moonlit-run-game-over.png'),
  canvas.toBuffer('image/png'),
);
console.log(output);
