/* Actual Chromium validation, including broken user behavior. No canvas mocks. */
const { app } = require('electron');
// Each check destroys its isolated window; keep the test host alive between cases.
app.on('window-all-closed', () => {});
const fs = require('fs');
const path = require('path');
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' },
});
const validate = require('../src/main/game/browser-validator.ts').default;
const { gameHtml } = require('../src/main/game/preview.ts');
const { applyThemePatch, validateTheme } = require('../src/main/game/theme-data.ts');
const { flightBehavior } = require('../src/main/game/behavior-presets.ts');
const base = require('../src/main/game/theme.json');
const examples = require('../src/main/game/examples.json');
const engine = fs.readFileSync(path.join(__dirname, '../src/main/game/engine.js'), 'utf8');
const behavior = fs.readFileSync(path.join(__dirname, '../src/main/game/behavior.js'), 'utf8');
const results = [];
app.whenReady().then(async () => {
  try {
    const benchmark = path.resolve(__dirname, '../../artifacts/game-v2/benchmark/results.json');
    const published = fs.existsSync(benchmark)
      ? JSON.parse(fs.readFileSync(benchmark, 'utf8')).filter((r) => r.success)
      : [];
    const cases = [
      { name: 'original', theme: base, behavior },
      ...examples.map((e) => ({ name: e.request, theme: applyThemePatch(base, e.changes), behavior: e.changes.behaviorPreset === 'flight' ? flightBehavior : behavior })),
      { name: 'morning palette', theme: applyThemePatch(base, {timeOfDay:'morning'}), behavior },
      { name: 'sunset palette', theme: applyThemePatch(base, {timeOfDay:'sunset'}), behavior },
      { name: 'solid sky', theme: applyThemePatch(base, {background:{type:'solid',colors:['#b4ddeb']}}), behavior },
      { name: 'flight label without flight behavior', theme: applyThemePatch(base, {behaviorPreset:'flight'}), behavior, expected: /Flying controls/ },
      ...published.map((r) => ({ name: 'published: ' + r.id, theme: r.theme, behavior })),
      { name: 'throwing behavior', theme: base, behavior: 'export function onStep(){throw Error("Intentional broken behavior");}', expected: /Intentional broken behavior/ },
      { name: 'infinite behavior', theme: base, behavior: 'export function onStep(){while(true){}}', expected: /timed out/ },
    ];
    for (const c of cases) {
      const start = Date.now();
      let error;
      try {
        validateTheme(c.theme);
        await validate(gameHtml(engine, c.behavior, c.theme, 'browser-test'));
      } catch (e) { error = e.message; }
      const passed = c.expected ? c.expected.test(error || '') : !error;
      results.push({ name: c.name, passed, seconds: (Date.now() - start) / 1000, error: error || null });
      console.log(JSON.stringify(results.at(-1)));
    }
    const out = process.env.COCO_BROWSER_TEST_OUTPUT || path.resolve(__dirname, '../../artifacts/game-v2/browser-validation.json');
    fs.writeFileSync(out, JSON.stringify(results, null, 2));
    app.exit(results.every((r) => r.passed) ? 0 : 1);
  } catch (e) { console.error(e); app.exit(1); }
});
