/* Replay a model-published version and record its actual input-driven motion. */
const { app, BrowserWindow } = require('electron');
const fs=require('fs'),path=require('path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'commonjs',moduleResolution:'node'}});
const {gameHtml}=require('../src/main/game/preview.ts');
app.whenReady().then(async()=>{
 try {
  const profile=process.env.COCO_FLIGHT_PROFILE;
  if(!profile)throw Error('COCO_FLIGHT_PROFILE is required');
  const output=path.resolve('artifacts/game-polish/flight-replay');fs.mkdirSync(output,{recursive:true});
  const rows=JSON.parse(fs.readFileSync(path.resolve('artifacts/game-polish/live/results.json'),'utf8'));
  const version=rows.find(r=>r.flight)?.version;if(!version)throw Error('No published flying version');
  const root=path.join(profile,'runner-tutorial');let folder;
  for(const user of fs.readdirSync(root))for(const id of fs.readdirSync(path.join(root,user))){const p=path.join(root,user,id,'versions',version);if(fs.existsSync(p))folder=p;}
  if(!folder)throw Error('Published version is missing');
  const html=gameHtml(fs.readFileSync(path.join(folder,'engine.js'),'utf8'),fs.readFileSync(path.join(folder,'behavior.js'),'utf8'),JSON.parse(fs.readFileSync(path.join(folder,'theme.json'),'utf8')),version);
  const w=new BrowserWindow({width:960,height:540,show:true,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
  await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
  await w.webContents.executeJavaScript(`globalThis.__cocoGame.reset();dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}))`);
  const heights=[];
  for(let i=0;i<30;i++){
    if(i===11)await w.webContents.executeJavaScript(`dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}))`);
    const d=await w.webContents.executeJavaScript(`({png:document.querySelector('canvas').toDataURL('image/png').split(',')[1],y:globalThis.__cocoGame.state().y,time:globalThis.__cocoGame.state().time})`);
    fs.writeFileSync(path.join(output,String(i).padStart(3,'0')+'.png'),Buffer.from(d.png,'base64'));heights.push({frame:i,y:d.y,time:d.time,held:i<11});await sleep(80);
  }
  if(Math.max(...heights.filter(h=>h.held).map(h=>h.y))<40||heights.at(-1).y>5)throw Error('Recorded flight did not rise and return to the ground');
  fs.writeFileSync(path.join(output,'recording.json'),JSON.stringify({version,input:'actual keyboard handlers; no direct position edits or manual simulation steps',heights},null,2));w.destroy();app.exit(0);
 } catch(e){console.error(e);app.exit(1)}
});
