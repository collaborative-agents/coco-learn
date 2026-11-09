/* Read actual service/model health and render Coco Health in an isolated profile. */
const {app,BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path');
const out=process.env.COCO_HEALTH_OUTPUT||path.resolve('artifacts/coco-health');fs.mkdirSync(out,{recursive:true});
const events=[];
function record(step,data={}){events.push({step,...data});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(events,null,2));console.log('HEALTH',JSON.stringify(events.at(-1)));}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function bounded(label,promise,ms=22000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]);}finally{clearTimeout(timer);}}
async function wait(label,fn,ms=45000){const end=Date.now()+ms;while(Date.now()<end){const value=await bounded(label,fn(),Math.min(22000,end-Date.now()));if(value)return value;await sleep(200);}throw Error(label+' timed out');}
const run=(w,source)=>bounded('renderer',w.webContents.executeJavaScript(source,true));
const invoke=(w,name,payload)=>run(w,`window.electron.ipcRenderer.invoke(${JSON.stringify(name)},${JSON.stringify(payload??{})})`);
let failed=false;app.on('will-quit',()=>{if(failed)app.exit(1);});
app.whenReady().then(async()=>{
 try{
  const chat=await wait('chat',()=>BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents.getURL().includes('view=session')&&!w.webContents.isLoadingMainFrame()));
  chat.webContents.setBackgroundThrottling(false);
  let health;
  await wait('authorized health response',async()=>{try{health=await invoke(chat,'get-service-health',{forceModelTest:false});return Boolean(health?.sensing&&health?.tutor);}catch{return false;}});
  record('initial-health',{health});
  await run(chat,`[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Settings'||b.title==='Settings')?.click()`);
  await wait('Health navigation',()=>run(chat,`Boolean([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Health'))`));
  await run(chat,`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Health').click()`);
  await wait('Health rows rendered',()=>run(chat,`Boolean(document.querySelector('[aria-label^="Sensing server:"]')&&document.querySelector('[aria-label^="Tutor agent:"]'))`));
  fs.writeFileSync(path.join(out,'startup-health.png'),(await bounded('capture',chat.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}),8000)).toPNG());
  const started=Date.now();health=await invoke(chat,'get-service-health',{forceModelTest:true});
  record('forced-model-check',{seconds:(Date.now()-started)/1000,health});
  health=await wait('services and actual model requests ready',async()=>{
    const next=await invoke(chat,'get-service-health',{forceModelTest:false});
    const failed=['sensing','tutor'].find(role=>next[role]?.modelAssessment?.status==='failed');
    if(failed)throw Error(failed+': '+next[failed].modelAssessment.detail);
    return ['sensing','tutor'].every(role=>next[role]?.connected&&next[role].modelAssessment?.status==='verified')?next:null;
  });
  record('ready-health',{health});
  await wait('Health automatically displays recovery',()=>run(chat,`[...document.querySelectorAll('[aria-label^="Sensing server:"],[aria-label^="Tutor agent:"]')].filter(e=>e.getAttribute('aria-label').includes('Connected (service); Connected (model)')).length===2`),12000);
  await sleep(300);fs.writeFileSync(path.join(out,'health.png'),(await bounded('capture',chat.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}),8000)).toPNG());
  const labels=await run(chat,`[...document.querySelectorAll('[aria-label^="Sensing server:"],[aria-label^="Tutor agent:"]')].map(e=>e.getAttribute('aria-label'))`);
  record('visible-health',{labels});
  if(!['sensing','tutor'].every(role=>health[role].connected&&health[role].modelAssessment?.status==='verified'))throw Error('A real service/model check failed; see recorded health details');
  if(labels.length!==2||labels.some(x=>!x.includes('Connected (service); Connected (model)')))throw Error('Coco Health did not display the verified results');
  record('PASS');app.quit();
 }catch(error){failed=true;record('FAIL',{error:String(error.stack||error)});app.quit();}
});
