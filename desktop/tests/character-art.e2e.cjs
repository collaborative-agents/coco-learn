/* Isolated Chromium art/controls check; does not touch the user's game or account. */
const {app, BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path');
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'commonjs',moduleResolution:'node'}});
const {applyThemePatch,validatePlayerArtwork}=require('../src/main/game/theme-data');
const {gameHtml}=require('../src/main/game/preview');
const validate=require('../src/main/game/browser-validator').default;
const original=require('../src/main/game/theme.json');
const engine=fs.readFileSync(path.join(__dirname,'../src/main/game/engine.js'),'utf8');
const behavior=fs.readFileSync(path.join(__dirname,'../src/main/game/behavior.js'),'utf8');
const out=path.resolve(__dirname,'../../artifacts/character-quality');
app.setPath('userData',fs.mkdtempSync(path.join(app.getPath('temp'),'coco-art-check-')));
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 try{
  fs.mkdirSync(out,{recursive:true});const results=[];
  for(const name of ['cat','dog','rabbit','pig']){
   const theme=applyThemePatch(original,{playerPreset:name,timeOfDay:'day'});
   validatePlayerArtwork(original,theme);
   const html=gameHtml(engine,behavior,theme,'art-check');
   await validate(html);
   const w=new BrowserWindow({show:false,width:1100,height:740,webPreferences:{offscreen:true,backgroundThrottling:false}});
   await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));
   await new Promise(r=>setTimeout(r,400));
   fs.writeFileSync(path.join(out,name+'.png'),(await w.webContents.capturePage()).toPNG());
   w.destroy();results.push({name,browserValidation:'passed',canvas:'34x26',scale:3,frames:4});
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));app.exit(0);
 }catch(e){console.error(e);app.exit(1)}
});
