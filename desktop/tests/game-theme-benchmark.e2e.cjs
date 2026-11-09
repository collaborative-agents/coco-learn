/* Actual Electron IPC, model, tools, validator and renderer. Never answers approvals. */
const { app, BrowserWindow } = require('electron');
const fs = require('fs'),
  path = require('path');
const out =
  process.env.COCO_GAME_BENCH_OUTPUT ||
  path.resolve('artifacts/game-v2/benchmark');
fs.mkdirSync(out, { recursive: true });
const results = [],
  events = [];
let failed = false;
app.on('will-quit', () => {
  if (failed) app.exit(1);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function bounded(label,promise,ms=10000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms)})]);}finally{clearTimeout(timer)}}
function log(step, data = {}) {
  events.push({ at: new Date().toISOString(), step, ...data });
  fs.writeFileSync(
    path.join(out, 'events.json'),
    JSON.stringify(events, null, 2),
  );
  console.log('BENCH', JSON.stringify(events.at(-1)));
}
const win = (view) =>
  BrowserWindow.getAllWindows().find(
    (w) => !w.isDestroyed() && w.webContents.getURL().includes('view=' + view),
  );
async function wait(label, fn, timeout = 140000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const r = await bounded(label,fn(),Math.min(10000,until-Date.now()));
    if (r) return r;
    await sleep(100);
  }
  throw Error(label + ' timed out');
}
const invoke = (w, c, p) =>
  bounded(c,w.webContents.executeJavaScript(
    `window.electron.ipcRenderer.invoke(${JSON.stringify(c)},${JSON.stringify(p ?? null)})`,
    true,
  ));
async function capture(w, file) {
  w.webContents.setBackgroundThrottling(false);
  await sleep(150);
  fs.writeFileSync(
    path.join(out, file),
    (await bounded('screenshot '+file,w.webContents.capturePage(undefined, { stayHidden:true, stayAwake: true }),8000)).toPNG(),
  );
}
async function renderedGame(game, state) {
  await wait('published preview and canvas painted', async () => {
    const ready = await game.webContents.executeJavaScript(
      `Boolean(document.querySelector('iframe')?.srcdoc.includes(${JSON.stringify(state.version)})) && !document.querySelector('header')?.innerText.includes('checking') && !document.querySelector('header')?.innerText.includes('Coco is working')`,
    );
    if (!ready) return false;
    const frame = game.webContents.mainFrame.framesInSubtree.find(
      (f) => f.url === 'about:srcdoc',
    );
    return frame?.executeJavaScript(`(()=>{const c=document.querySelector('canvas');if(!c||!globalThis.__cocoGame)return false;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const colors=new Set();for(let i=0;i<d.length;i+=64)colors.add(d[i]+','+d[i+1]+','+d[i+2]);return colors.size>2})()`);
  }, 15000);
  // capturePage can precede the compositor even after canvas pixels are ready.
  await sleep(400);
}
function themeFor(s) {
  const root = path.join(app.getPath('userData'), 'runner-tutorial');
  const user = fs
    .readdirSync(root)
    .find((u) => fs.existsSync(path.join(root, u, s.sessionId)));
  return JSON.parse(
    fs.readFileSync(
      path.join(root, user, s.sessionId, 'work', 'theme.json'),
      'utf8',
    ),
  );
}
function diff(a, b) {
  return Object.keys(b).filter(
    (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  );
}
function check(kind, t, b) {
  const d = diff(b, t),
    player =
      JSON.stringify(t.player.frames) !== JSON.stringify(b.player.frames),
    names = t.obstacles
      .map((o) => o.name)
      .join(' ')
      .toLowerCase();
  switch (kind) {
    case 'day':
      return (
        ['day', 'morning'].includes(t.timeOfDay) ||
        t.background.colors.some((c) => {
          const x = parseInt(c.slice(1), 16);
          return (x >> 16) + ((x >> 8) & 255) + (x & 255) > 480;
        })
      );
    case 'visual':
      return d.some((k) => !['physics', 'sounds'].includes(k));
    case 'dog':
      return player && /dog|puppy/i.test(t.player.name) && /bone/.test(names);
    case 'snow-night':
      return (
        t.timeOfDay === 'night' &&
        t.weather.kind === 'snow' &&
        t.decorations.some((d) => d.kind === 'stars')
      );
    case 'harder':
      return (
        t.physics.speed > b.physics.speed ||
        t.physics.spawnSeconds < b.physics.spawnSeconds
      );
    case 'original-platform':
      return d.length > 1 && !/mario|luigi/i.test(t.player.name);
    case 'detailed-cat':
      return (
        t.detail === 'detailed' &&
        t.timeOfDay === 'day' &&
        player &&
        /cat|kitten/i.test(t.player.name)
      );
    case 'morning':
      return (
        t.timeOfDay === 'morning' &&
        t.decorations.some((d) => d.kind === 'clouds')
      );
    case 'rain':
      return t.weather.kind === 'rain';
    case 'sunset':
      return t.timeOfDay === 'sunset';
    case 'space':
      return t.decorations.some((d) => d.kind === 'stars') && d.length > 0;
    case 'rabbit':
      return player && /rabbit|bunny/i.test(t.player.name);
    case 'cactus':
      return (
        /cact/.test(names) &&
        JSON.stringify(t.obstacles) !== JSON.stringify(b.obstacles)
      );
    case 'blue-only':
      return (
        JSON.stringify(t.physics) === JSON.stringify(b.physics) &&
        JSON.stringify(t.obstacles) === JSON.stringify(b.obstacles) &&
        JSON.stringify(t.background) === JSON.stringify(b.background) &&
        (player || d.includes('spritePalette'))
      );
    case 'snow-cat':
      return (
        t.weather.kind === 'snow' &&
        t.timeOfDay === 'night' &&
        player &&
        /cat|kitten/i.test(t.player.name)
      );
    case 'score':
      return t.sounds === false && t.scoreLabel === 'DISTANCE';
    case 'jump':
      return (
        t.physics.gravity < b.physics.gravity ||
        t.physics.jumpVelocity > b.physics.jumpVelocity
      );
    default:
      return d.length > 0;
  }
}
async function submit(chat, text) {
  chat.show();
  await chat.webContents.executeJavaScript(
    `(()=>{const t=document.querySelector('textarea[aria-label="Message Coco"]');if(!t)throw Error('No composer');t.focus();})()`,
  );
  await chat.webContents.insertText(text);
  await wait(
    'Send ready',
    () =>
      chat.webContents.executeJavaScript(
        `Boolean(document.querySelector('button[aria-label="Send"]')&&!document.querySelector('button[aria-label="Send"]').disabled)`,
      ),
    10000,
  );
  await chat.webContents.executeJavaScript(
    `document.querySelector('button[aria-label="Send"]').click()`,
  );
}
app.whenReady().then(async () => {
  try {
    log('app-ready');
    const chat = await wait(
      'chat window',
      () => {
        const w = win('session');
        return w && !w.webContents.isLoadingMainFrame() ? w : null;
      },
      35000,
    );
    chat.webContents.setBackgroundThrottling(false);
    log('chat-ready');
    await wait(
      'services/models',
      async () => {
        let h;
        try {
          h = await invoke(chat, 'get-service-health', {});
        } catch {
          return false;
        }
        return (
          h?.sensing?.connected &&
          h?.tutor?.connected &&
          h.sensing.modelAssessment?.status === 'verified' &&
          h.tutor.modelAssessment?.status === 'verified'
        );
      },
      45000,
    );
    log('services-models-ready');
    const mode = process.env.COCO_GAME_BENCH_MODE;
    if (mode === 'resume') {
      const s = await invoke(chat, 'runner-state');
      if (s?.failure?.kind !== 'interrupted' || !s.lastRequest)
        throw Error('Interrupted run was not restored honestly');
      const p = await invoke(chat, 'runner-preview');
      if (p.state.previewKind !== 'original')
        throw Error('Unpublished draft survived as a published game');
      await invoke(chat,'runner-start');
      await wait('interruption explanation',()=>chat.webContents.executeJavaScript(`document.body.innerText.includes('Coco closed before finishing')`));
      await capture(chat, 'reopened-after-interruption.png');
      log('PASS-reopen', { state: s });
      await wait('enabled retry for interrupted game',()=>chat.webContents.executeJavaScript(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>['Try again','Retry'].includes(b.textContent.trim()));return Boolean(b&&!b.disabled)})()`),15000);
      await chat.webContents.executeJavaScript(`[...document.querySelectorAll('button')].find(b=>['Try again','Retry'].includes(b.textContent.trim())&&!b.disabled).click()`);
      const recovered = await wait('interrupted request retried and published', async () => {
        if (await chat.webContents.executeJavaScript(`Boolean(document.querySelector('[data-pending-permission]'))`))
          throw Error('Unexpected approval after restart; benchmark never approves');
        const next = await invoke(chat, 'runner-state');
        if (next.error && next.failure?.kind !== 'interrupted') throw Error(next.error);
        return next.phase === 'review' && next.version !== s.version ? next : null;
      });
      const game = win('runner-game');
      log('retry-published', { state: recovered });
      await invoke(chat,'runner-action',{sessionId:recovered.sessionId,action:'open-game'});
      await wait('retry preview shows published version',()=>game.webContents.executeJavaScript(`Boolean(document.querySelector('iframe')?.srcdoc.includes(${JSON.stringify(recovered.version)}))`),20000);
      await sleep(500);
      await capture(game, 'retried-after-reopening.png');
      await capture(chat, 'retried-after-reopening-chat.png');
      log('PASS-reopen-retry', { state: recovered, autoApprovals: 0 });
      app.quit();
      return;
    }
    let state = (await invoke(chat, 'runner-start')).state;
    let prompts = require('./game-theme-prompts.json');
    if (process.env.COCO_GAME_BENCH_IDS)
      prompts = prompts.filter((p) =>
        process.env.COCO_GAME_BENCH_IDS.split(',').includes(p.id),
      );
    if (process.env.COCO_GAME_BENCH_LIMIT)
      prompts = prompts.slice(0, Number(process.env.COCO_GAME_BENCH_LIMIT));
    if (mode === 'interrupt')
      prompts = [
        {
          id: 'interrupt',
          prompt: 'Make a detailed daylight scene with a cat and snow',
          expect: 'visual',
        },
      ];
    if (mode === 'extras')
      prompts = [
        {
          id: 'question',
          prompt: 'what change would you recommend?',
          expect: 'question',
        },
        {
          id: 'invalid',
          prompt:
            'Set gravity to -1000 and speed to -500. Do not clamp these values.',
          expect: 'invalid',
        },
      ];
    for (const [index, item] of prompts.entries()) {
      if (index || mode === 'extras')
        state = (
          await invoke(chat, 'runner-action', {
            sessionId: state.sessionId,
            action: 'new-game',
          })
        ).state;
      await invoke(chat, 'runner-action', {
        sessionId: state.sessionId,
        action: 'customize',
      });
      await wait(
        'empty composer',
        () =>
          chat.webContents.executeJavaScript(
            `document.querySelector('textarea[aria-label="Message Coco"]')?.value===''`,
          ),
        10000,
      );
      const before = themeFor(state),
        start = Date.now();
      log('start', { id: item.id, prompt: item.prompt });
      await submit(chat, item.prompt);
      if (mode === 'interrupt') {
        await wait(
          'run building',
          async () => {
            const s = await invoke(chat, 'runner-state');
            return s.phase === 'building' ? s : null;
          },
          15000,
        );
        await capture(chat, 'closed-mid-run.png');
        log('closed-mid-run', { beforeVersion: state.version });
        app.quit();
        return;
      }
      let result, problem;
      try {
        let began = false;
        result = await wait('game result', async () => {
          if (
            await chat.webContents.executeJavaScript(
              `Boolean(document.querySelector('[data-pending-permission]'))`,
            )
          )
            throw Error('Unexpected approval prompt; benchmark never approves');
          const s = await invoke(chat, 'runner-state');
          if (s.phase === 'building') began = true;
          if (s.error) return s;
          if (s.phase === 'review' && s.version !== state.version) return s;
          if (item.expect === 'question' && began && s.phase !== 'building')
            return s;
          return null;
        });
      } catch (e) {
        problem = e.message;
        result = await invoke(chat, 'runner-state');
      }
      const seconds = +((Date.now() - start) / 1000).toFixed(2);
      await wait('final answer delivered to the chat', () =>
        chat.webContents.executeJavaScript(
          `![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Stop')`,
        ), 15000);
      const conversation = (await invoke(chat, 'get-chat-conversations', { includeQuests: true }))
        .find((c) => c.sessionId === result.sessionId);
      const answer = conversation?.messages.filter((m) => m.role === 'tutor').at(-1);
      await sleep(250);
      const after = themeFor(result),
        changed = diff(before, after);
      let success;
      if (item.expect === 'question')
        success =
          !result.error && !changed.length && result.version === state.version &&
          Boolean(answer?.text?.trim() && !answer.isError);
      else if (item.expect === 'invalid')
        success =
          Boolean(result.error) &&
          !changed.length &&
          result.version === state.version;
      else
        success =
          !problem &&
          !result.error &&
          result.version !== state.version &&
          check(item.expect, after, before);
      let screenshot = `${String(index + 1).padStart(2, '0')}-${item.id}.png`;
      const game = win('runner-game');
      if (game) {
        await renderedGame(game, result);
        await capture(game, screenshot);
      } else {
        await capture(chat, screenshot);
      }
      await capture(
        chat,
        `${String(index + 1).padStart(2, '0')}-${item.id}-chat.png`,
      );
      const open = await chat.webContents.executeJavaScript(
        `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Open my game')`,
      );
      if (result.error && open) {
        success = false;
        problem = 'Game link implied success after failure';
      }
      const row = {
        id: item.id,
        prompt: item.prompt,
        success,
        seconds,
        under30: seconds < 30,
        changed,
        screenshot,
        error:
          problem ||
          result.error ||
          (!success ? 'Requested properties were not satisfied' : null),
        state: result,
        answer: answer?.text,
        theme: after,
      };
      results.push(row);
      fs.writeFileSync(
        path.join(out, 'results.json'),
        JSON.stringify(results, null, 2),
      );
      log('result', {
        id: item.id,
        success,
        seconds,
        changed,
        error: row.error,
      });
      state = result;
      await sleep(200);
    }
    log('complete', {
      successes: results.filter((r) => r.success).length,
      total: results.length,
      autoApprovals: 0,
    });
    app.quit();
  } catch (e) {
    failed = true;
    log('FATAL', { error: e.stack });
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed())
        await capture(w, 'failure-' + w.id + '.png').catch(() => {});
    }
    app.quit();
  }
});
