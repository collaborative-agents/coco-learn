/* Screenshots of the actual React presentation and live Chromium canvas. */
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
app.on('window-all-closed', () => {});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const output = path.resolve(__dirname, '../../../artifacts/game-polish');
const pages = process.env.COCO_DESIGN_OUTPUT || '/private/tmp/coco-game-polish-preview';
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ width: 1280, height: 980, show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, backgroundThrottling: false } });
    const results = [];
    for (const name of ['night', 'day', 'morning', 'sunset', 'night-over', 'day-compact']) {
      if (name === 'day-compact') win.setContentSize(1000, 820);
      await win.loadFile(path.join(pages, (name === 'day-compact' ? 'day' : name) + '.html'));
      for (let i = 0; i < 100; i++) {
        if (await win.webContents.executeJavaScript('Boolean(document.querySelector("iframe"))')) break;
        await sleep(100);
      }
      const frame = win.webContents.mainFrame.framesInSubtree.find(f => f.url === 'about:srcdoc');
      if (!frame) throw Error('Missing actual game iframe');
      await frame.executeJavaScript(`(()=>{globalThis.__cocoPreviewFreeze=true;const g=globalThis.__cocoGame;g.reset();for(let i=0;i<132;i++)g.step(1/60);g.jump();for(let i=0;i<12;i++)g.step(1/60);${name.endsWith('over') ? 'g.state().y=0;g.state().velocity=0;g.state().obstacles[0].x=135;g.step(1/60);if(!g.state().over)throw Error("Expected real collision");' : ''}g.render();})()`);
      await sleep(700);
      const layout = await win.webContents.executeJavaScript(`(()=>{const q=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}};return {card:q('.coco-game-card'),companion:q('.coco-game-companion'),bodyHeight:document.body.scrollHeight,viewport:innerHeight}})()`);
      fs.writeFileSync(path.join(output, name + '.png'), (await win.webContents.capturePage(undefined, { stayAwake: true })).toPNG());
      results.push({ name, layout, actualChromium: true, isolatedDesignPreview: true });
      fs.writeFileSync(path.join(output, 'layout.json'), JSON.stringify(results, null, 2));
      if (layout.bodyHeight > layout.viewport + 2) throw Error(name + ': preview clips below the window ' + JSON.stringify(layout));
    }
    fs.writeFileSync(path.join(output, 'layout.json'), JSON.stringify(results, null, 2));
    const frames = '/private/tmp/coco-game-polish-motion';
    fs.mkdirSync(frames, { recursive: true });
    await win.loadFile(path.join(pages, 'night.html'));
    await sleep(400);
    const frame = win.webContents.mainFrame.framesInSubtree.find(f => f.url === 'about:srcdoc');
    await frame.executeJavaScript('globalThis.__cocoPreviewFreeze=true;globalThis.__cocoGame.reset()');
    for (let i = 0; i < 36; i++) {
      const png = await frame.executeJavaScript(`(()=>{const g=globalThis.__cocoGame;${i === 15 ? 'g.jump();' : ''}for(let j=0;j<5;j++)g.step(1/60);g.render();return document.querySelector('canvas').toDataURL('image/png').split(',')[1]})()`);
      fs.writeFileSync(path.join(frames, String(i).padStart(3, '0') + '.png'), Buffer.from(png, 'base64'));
      await sleep(65);
    }
    win.destroy();app.exit(0);
  } catch (error) { console.error(error);app.exit(1); }
});
