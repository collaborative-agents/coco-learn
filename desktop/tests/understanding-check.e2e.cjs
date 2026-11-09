/* Real isolated Electron app, tutor/model and unsent draft. Never answers approvals. */
const {app,BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const out=process.env.COCO_CHECK_OUTPUT||path.resolve('artifacts/understanding-check');
fs.mkdirSync(out,{recursive:true});
const events=[];
function log(step,data={}){events.push({step,...data});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(events,null,2));console.log('CHECK',JSON.stringify(events.at(-1)));}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function bounded(label,promise,ms=10000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms);})]);}finally{clearTimeout(timer);}}
async function wait(label,fn,ms=45000){const end=Date.now()+ms;while(Date.now()<end){const value=await bounded(label,fn(),Math.min(10000,end-Date.now()));if(value)return value;await sleep(150);}throw Error(label+' timed out');}
const windowFor=view=>BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents.getURL().includes('view='+view));
const run=(w,code)=>bounded('renderer',w.webContents.executeJavaScript(code,true));
const invoke=(w,channel,payload)=>run(w,`window.electron.ipcRenderer.invoke(${JSON.stringify(channel)},${JSON.stringify(payload??null)})`);
async function click(w,name){const ok=await run(w,`(()=>{const b=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')===${JSON.stringify(name)}||b.textContent.trim()===${JSON.stringify(name)})&&!b.disabled);if(!b)return false;b.click();return true})()`);if(!ok)throw Error('Missing enabled '+name);}
async function capture(w,name){await sleep(200);fs.writeFileSync(path.join(out,name+'.png'),(await bounded('capture',w.webContents.capturePage(undefined,{stayAwake:true,stayHidden:true}),8000)).toPNG());}
function contrast(a,b){const luminance=rgb=>{const c=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function workspaceHash(state){const root=path.join(app.getPath('userData'),'runner-tutorial');const user=fs.readdirSync(root).find(u=>fs.existsSync(path.join(root,u,state.sessionId)));const work=path.join(root,user,state.sessionId,'work');return crypto.createHash('sha256').update(fs.readFileSync(path.join(work,'theme.json'))).update(fs.readFileSync(path.join(work,'behavior.js'))).digest('hex');}
let failed=false;
app.on('will-quit',()=>{if(failed)app.exit(1);});
app.whenReady().then(async()=>{
 try{
  const chat=await wait('chat',()=>{const w=windowFor('session');return w&&!w.webContents.isLoadingMainFrame()?w:null;});
  chat.webContents.setBackgroundThrottling(false);
  await wait('services/models',async()=>{try{const h=await invoke(chat,'get-service-health',{});return h?.sensing?.connected&&h?.tutor?.connected&&h.tutor.modelAssessment?.status==='verified'&&h.sensing.modelAssessment?.status==='verified';}catch{return false;}},60000);
  await click(chat,'Training tasks');
  const style=()=>run(chat,`(()=>{const b=document.querySelector('.getting-started-primary'),s=getComputedStyle(b),c=getComputedStyle(document.querySelector('.getting-started-task'));return {background:s.backgroundColor,color:s.color,card:c.backgroundColor}})()`);
  const normal=await style();await capture(chat,'01-blue-card');
  const point=await run(chat,`(()=>{const b=document.querySelector('.getting-started-primary');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  chat.webContents.debugger.attach('1.3');
  await chat.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await sleep(120);
  const hover=await style();await capture(chat,'02-start-hover');chat.webContents.debugger.detach();
  for(const [name,s] of Object.entries({normal,hover})){const ratio=contrast(s.color,s.background);if(ratio<4.5)throw Error(name+' contrast failed: '+ratio);log('button-contrast',{name,...s,ratio});}
  if(hover.background===normal.background)throw Error('Native hover was not exercised');
  await click(chat,'Start Task');const state=await invoke(chat,'runner-state');
  await wait('native game',()=>windowFor('runner-game'));
  await invoke(chat,'runner-action',{sessionId:state.sessionId,action:'customize'});
  await wait('game composer',()=>run(chat,`document.querySelector('textarea[aria-label="Message Coco"]')?.value===''&&Boolean(document.querySelector('.game-idea-check'))`));
  await click(chat,'Check my understanding');
  await wait('empty-draft explanation',()=>run(chat,`document.querySelector('[role=alert]')?.innerText.includes('Write your game idea first')`));
  const draft='Make the fox a cat in a bright snowy morning';
  await run(chat,`document.querySelector('textarea[aria-label="Message Coco"]').focus()`);await chat.webContents.insertText(draft);
  const before=await invoke(chat,'runner-state'),hash=workspaceHash(before);
  await capture(chat,'03-before-check');
  const started=Date.now();await click(chat,'Check my understanding');
  await wait('inline model interpretation',async()=>{
    const r=await run(chat,`({result:document.querySelector('.game-idea-check-result')?.innerText,error:document.querySelector('[role=alert]')?.innerText,approval:Boolean(document.querySelector('[data-pending-permission]'))})`);
    if(r.approval)throw Error('Unexpected approval; test never approves');if(r.error)throw Error(r.error);return r.result;
  });
  if(process.env.COCO_CHECK_RETURN_ACTION==='1'){
    const bubble=await wait('native coaching bubble',()=>windowFor('avatar-bubble'));
    const backVisible=()=>run(bubble,`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Back to my idea')`);
    chat.show();chat.focus();
    await wait('current chat hides return action',async()=>chat.isFocused()&&await run(bubble,`document.body.innerText.includes('DID I GET IT?')`)&&!await backVisible());
    await capture(bubble,'06-already-in-chat');
    await click(chat,'Training tasks');await wait('training keeps return action',backVisible);
    await capture(bubble,'07-return-from-training');
    await click(chat,'Chat');await wait('back in chat hides return action',async()=>await run(bubble,`document.body.innerText.includes('DID I GET IT?')`)&&!await backVisible());
    await invoke(chat,'runner-start');
    await wait('welcome-back hides redundant return',async()=>await run(bubble,`document.body.innerText.includes('WELCOME BACK')`)&&!await backVisible());
    await capture(bubble,'08-welcome-already-in-chat');
    await click(chat,'Settings');await wait('settings keeps return action',backVisible);
    await invoke(chat,'runner-action',{sessionId:before.sessionId,action:'dismiss'});
    await wait('dismissed coaching hidden',()=>!bubble.isVisible());
    await click(chat,'Chat');await click(chat,'Training tasks');await click(chat,'Chat');await sleep(300);
    if(bubble.isVisible())throw Error('Dismissed coaching returned after navigation');
    log('contextual-return-action',{hiddenInGameChat:true,shownInTraining:true,shownInSettings:true,hiddenOnWelcomeBack:true,dismissalPreserved:true});
    log('PASS',{defaultPermissions:true});app.quit();return;
  }
  for(const view of ['avatar','avatar-bubble'])windowFor(view)?.hide();
  await capture(chat,'04-result-without-avatar');
  const after=await invoke(chat,'runner-state');
  const result=await run(chat,`({text:document.querySelector('.game-idea-check-result').innerText,draft:document.querySelector('textarea[aria-label="Message Coco"]').value})`);
  if(result.draft!==draft||before.version!==after.version||workspaceHash(after)!==hash)throw Error('Understanding check submitted or changed the game');
  log('real-check',{seconds:(Date.now()-started)/1000,result:result.text,draftPreserved:true,versionUnchanged:true,filesUnchanged:true,avatarHidden:true,autoApprovals:0});
  // Kill only the tutor owned by this isolated Electron process, then check fast failure.
  const port=process.env.TUTOR_PORT;if(!port)throw Error('Dedicated TUTOR_PORT is required');
  const pid=Number(cp.execFileSync('/usr/sbin/lsof',['-tiTCP:'+port,'-sTCP:LISTEN'],{encoding:'utf8'}).trim().split('\n')[0]);
  const parent=Number(cp.execFileSync('/bin/ps',['-o','ppid=','-p',String(pid)],{encoding:'utf8'}).trim());
  if(parent!==process.pid)throw Error('Refusing to stop a tutor not owned by this test');
  process.kill(pid,'SIGTERM');await sleep(300);
  const offlineStart=Date.now();await click(chat,'Check my understanding');
  const error=await wait('offline error',()=>run(chat,`document.querySelector('[role=alert]')?.innerText`),8000);
  if(!error.includes('local tutor isn’t responding'))throw Error('Unexpected offline error: '+error);
  await capture(chat,'05-tutor-offline');log('offline-check',{seconds:(Date.now()-offlineStart)/1000,error});
  log('PASS',{defaultPermissions:true});app.quit();
 }catch(error){failed=true;log('FAIL',{error:String(error.stack||error)});for(const w of BrowserWindow.getAllWindows())await capture(w,'failure-'+w.id).catch(()=>{});app.quit();}
});
