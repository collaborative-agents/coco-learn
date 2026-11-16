/* Isolated design approval preview. Does not change the app entrypoint or flow. */
const path = require('path'), fs = require('fs');
const webpack = require('../../node_modules/webpack');
const root = path.resolve(__dirname, '../..');
const output = process.env.COCO_DESIGN_OUTPUT || '/private/tmp/coco-game-polish-preview';
fs.mkdirSync(output, { recursive: true });
webpack({
  mode: 'production', target: 'web', devtool: false,
  entry: path.join(__dirname, 'preview.tsx'),
  output: { path: output, filename: 'preview.js' },
  resolve: { extensions: ['.tsx', '.ts', '.js', '.json'], modules: [path.join(root, 'node_modules')] },
  resolveLoader: { modules: [path.join(root, 'node_modules')] },
  module: { rules: [
    { test: /\.tsx?$/, exclude: /node_modules/, use: { loader: 'ts-loader', options: { transpileOnly: true, compilerOptions: { module: 'esnext', moduleResolution: 'bundler' } } } },
    { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    { test: /\.(png|jpg|gif|svg)$/, type: 'asset/inline' },
  ] },
  optimization: { minimize: false },
}, (err, stats) => {
  if (err || stats.hasErrors()) { console.error(err || stats.toString({ all: false, errors: true })); process.exitCode = 1; return; }
  require('../../node_modules/ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs', moduleResolution: 'node' } });
  const { gameHtml } = require('../../src/main/game/preview.ts');
  const scenes = require('./scenes.json');
  const engine = fs.readFileSync(path.join(root, 'src/main/game/engine.js'), 'utf8')
    .replace('if (!document.hidden) step(dt);', 'if (!document.hidden && !globalThis.__cocoPreviewFreeze) step(dt);');
  fs.writeFileSync(path.join(output, 'engine.js'), engine);
  const behavior = fs.readFileSync(path.join(root, 'src/main/game/behavior.js'), 'utf8');
  const tokens = fs.readFileSync(path.join(root, 'src/renderer/theme/tokens.css'), 'utf8');
  for (const time of Object.keys(scenes)) {
    const theme = scenes[time];
    let html = gameHtml(engine, behavior, theme, 'design-' + time);
    const controls = `${tokens}*{box-sizing:border-box}body{margin:0;background:#fff;color:var(--coco-color-text-secondary);font:13px var(--coco-font-family)}canvas{display:block;width:100%;image-rendering:pixelated;outline-offset:-3px;outline:none}canvas:focus-visible{outline:2px solid #bcd0fc}nav{height:58px;display:flex;align-items:center;gap:8px;padding:10px 16px;background:#fff;border-top:1px solid #edf0f3}button{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:32px;font:600 11px var(--coco-font-family);color:#576475;border:1px solid #e5e7eb;border-radius:999px;background:#f9fafb;padding:7px 12px;cursor:pointer}button:hover{background:#edf2f8}button:focus-visible{outline:2px solid #204a79;outline-offset:2px}kbd{font:10px var(--coco-font-family);color:#8993a0;border:1px solid #e0e5eb;border-bottom-width:2px;border-radius:4px;background:white;padding:1px 4px}#pause{margin-left:auto;border-color:transparent;background:transparent}`;
    html = html.replace(/<style>[\s\S]*?<\/style>/, '<style>' + controls + '</style>')
      .replace('Jump ↑', 'Jump <kbd>Space</kbd>').replace('Duck ↓', 'Duck <kbd>↓</kbd>');
    for (const over of [false, true]) {
      const data = JSON.stringify({ title: theme.title, timeOfDay: time, html, updated: time !== 'night', gameOver: over }).replace(/</g, '\\u003c');
      const page = `<!doctype html><html><head><meta charset="utf-8"><title>Coco game design preview</title><style>html,body{margin:0}*{box-sizing:border-box}body{overflow-y:auto}</style></head><body><div id="root"></div><script>window.__cocoDesign=${data}</script><script src="preview.js"></script></body></html>`;
      fs.writeFileSync(path.join(output, time + (over ? '-over' : '') + '.html'), page);
    }
  }
  console.log('Isolated preview built:', output);
});
