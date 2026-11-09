/* Real account, real services/model, default permissions. Never approves a request. */
const {app,BrowserWindow}=require('electron');
const fs=require('fs'),path=require('path');
const out=process.env.COCO_TOUR_OUTPUT||path.resolve('../artifacts/setup-tour/live');
fs.mkdirSync(out,{recursive:true});
const events=[],results=[];let failed=false;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function log(step,data={}){events.push({step,...data});fs.writeFileSync(path.join(out,'events.json'),JSON.stringify(events,null,2));console.log('TOUR',JSON.stringify(events.at(-1)));}
async function bounded(label,promise,ms=15000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms)})]);}finally{clearTimeout(timer)}}
async function wait(label,fn,ms=45000){const end=Date.now()+ms;while(Date.now()<end){const value=await bounded(label,fn(),Math.min(15000,end-Date.now()));if(value)return value;await sleep(150);}throw Error(label+' timed out');}
const win=view=>BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents.getURL().includes('view='+view));
const run=(w,s)=>bounded('renderer',w.webContents.executeJavaScript(s,true));
const invoke=(w,c,p)=>run(w,`window.electron.ipcRenderer.invoke(${JSON.stringify(c)},${JSON.stringify(p??{})})`);
async function click(w,label){await wait('enabled '+label,()=>run(w,`Boolean([...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)})&&!b.disabled))`));await run(w,`[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)})&&!b.disabled).click()`);}
async function capture(w,name){if(w.webContents.getURL().includes('view=runner-game')&&await run(w,`Boolean(document.querySelector('iframe'))`)){await gameFrame(w);await sleep(500);}await sleep(300);fs.writeFileSync(path.join(out,name+'.png'),(await bounded('capture',w.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}),8000)).toPNG());}
async function noApproval(chat){if(await run(chat,`Boolean(document.querySelector('[data-pending-permission]'))`))throw Error('Unexpected pending permission. Test will not approve it.');}
async function gameFrame(game){return wait('game frame',async()=>{const f=game.webContents.mainFrame.framesInSubtree.find(f=>f.url==='about:srcdoc');if(!f)return null;try{return await bounded('loading game frame',f.executeJavaScript('Boolean(globalThis.__cocoGame)'),1500)?f:null}catch{return null}});}
function sources(state){const root=path.join(app.getPath('userData'),'runner-tutorial');const user=fs.readdirSync(root).find(u=>fs.existsSync(path.join(root,u,state.sessionId)));const work=path.join(root,user,state.sessionId,'work');return {theme:JSON.parse(fs.readFileSync(path.join(work,'theme.json'),'utf8')),behavior:fs.readFileSync(path.join(work,'behavior.js'),'utf8')};}
const diff=(a,b)=>Object.keys(b).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
function assertChange(id,t,b,behavior){
 if(/daylight|nov7|misspelled-day/.test(id)&&(!['day','morning'].includes(t.timeOfDay)||/moonlit/i.test(t.title)||t.decorations.some(d=>d.kind==='moon')))throw Error('Daylight sky, title, and decorations must agree');
 if(id==='flying'&&(t.controls.mode!=='fly'||!behavior.includes('jumpHeld')))throw Error('No flying behavior');
 if(id==='cat-snow'&&!(t.weather.kind==='snow'&&t.timeOfDay==='night'&&/cat/i.test(t.player.name)))throw Error('Cat/snow/night missing');
 if(id==='dog-bones'&& !(/dog|puppy/i.test(t.player.name)&&t.obstacles.some(o=>/bone/i.test(o.name))))throw Error('Dog/bones missing');
 if(id==='harder'&&!(t.physics.speed>b.physics.speed||t.physics.spawnSeconds<b.physics.spawnSeconds))throw Error('Difficulty unchanged');
 if(id==='ambitious-cat'&&!(t.timeOfDay==='day'&&/cat/i.test(t.player.name)))throw Error('Ambitious cat/day missing');
 if(id==='sunset'&&t.timeOfDay!=='sunset')throw Error('Not sunset');
 if(id==='misspelled-cat-snow'&&!(t.weather.kind==='snow'&&t.timeOfDay==='night'&&/cat/i.test(t.player.name)))throw Error('Misspelled cat/snow/night missing');
 if(id==='score-sounds'&&(t.scoreLabel!=='DISTANCE'||t.sounds))throw Error('Score/sound change missing');
 if(!diff(b,t).length)throw Error('No actual theme changes');
}
app.on('will-quit',()=>{if(failed)app.exit(1)});
app.whenReady().then(async()=>{
 try{
  if(['setup','setup-intro'].includes(process.env.COCO_TOUR_STAGE)){
   const setup=await wait('original setup',()=>{const w=win('onboarding');return w&&!w.webContents.isLoadingMainFrame()?w:null});
   setup.webContents.setBackgroundThrottling(false);
   if(process.env.COCO_TOUR_STAGE==='setup-intro') {
     await wait('visible onboarding window',()=>setup.isVisible());
     await sleep(500);
     if(win('avatar-bubble')?.isVisible())throw Error('Coco popped up before the window introduction');
     if(!await run(setup,`document.body.innerText.includes('floating desktop companion')&&!document.body.innerText.includes('Comparing options?')`))throw Error('Welcome copy still shows the stuck example');
     await capture(setup,'window-first');
   }
   for(let i=0;i<7;i++){
    if(setup.isDestroyed())break;
    const title=await run(setup,`document.querySelector('h1')?.textContent`);log('prior-setup',{title});await capture(setup,'setup-'+i);
    if(await run(setup,`Boolean(document.querySelector('#ob-user-name'))`)){
      const filled=await run(setup,`Boolean(document.querySelector('#ob-user-name').value.trim())`);if(!filled)throw Error('Existing account name was not restored');
    }
    if(title==='Permissions & privacy'){
      const permission=await invoke(setup,'get-system-permissions');log('existing-os-permissions',{missing:permission.missing});
      if(permission.missing?.length)throw Error('OS permissions need the user; walkthrough does not auto-grant.');
    }
    if(process.env.COCO_TOUR_STAGE==='setup-intro') {
      const avatar=BrowserWindow.getAllWindows().find(w=>/index.html$/.test(w.webContents.getURL()));
      if(avatar?.isVisible()||win('avatar-bubble')?.isVisible())throw Error('Floating Coco appeared before onboarding was finished');
      log('no-companion-during-setup',{title});
    }
    await click(setup,title==='Ready to go'?'Start Coco':'Next');await sleep(250);
   }
  }
  const chat=await wait('chat renderer',()=>{const w=win('session');return w&&!w.webContents.isLoadingMainFrame()?w:null});
  chat.webContents.setBackgroundThrottling(false);
  if (win('runner-game')) throw Error('The game must not replace onboarding or launch automatically.');
  if(process.env.COCO_TOUR_STAGE==='setup-intro') {
    await wait('Training rendered',()=>run(chat,`document.body.innerText.includes('Play with Coco')&&document.body.innerText.includes('Start Task')`));
    const bubble=await wait('welcome after onboarding',async()=>{const b=win('avatar-bubble');return b?.isVisible()&&await run(b,`document.body.innerText.includes('Please try the Getting Started task')`)?b:null});
    const avatar=BrowserWindow.getAllWindows().find(w=>/index.html$/.test(w.webContents.getURL()));
    if(!avatar?.isVisible()||win('onboarding')?.isVisible())throw Error('Expected Training with Coco after setup closed');
    await capture(chat,'training-after-setup');await capture(avatar,'coco-after-setup');await capture(bubble,'welcome-after-setup');
    log('PASS-companion-only-after-setup');app.quit();return;
  }

  if(['skipped-reopen','finished-reopen'].includes(process.env.COCO_TOUR_STAGE)){
    const saved=await wait('saved account tour',async()=>{try{return await invoke(chat,'runner-state')}catch{return null}});
    const expected=process.env.COCO_TOUR_STAGE==='skipped-reopen'?'skipped':'finished';
    if(saved.tour!==expected)throw Error('Tour completion did not survive reopening');
    await sleep(2000);if(win('runner-game'))throw Error('Completed/skipped tour unexpectedly reopened');
    if(expected==='finished'){
      if(!(await invoke(chat,'getting-started-status')).complete)throw Error('Task completion was lost on restart');
      await wait('persisted completed card',()=>run(chat,`Boolean(document.querySelector('.getting-started-task.is-complete'))`));
      await capture(chat,'completed-after-restart');
      const health=await wait('verified service and model connections',async()=>{const h=await invoke(chat,'get-service-health',{});return ['sensing','tutor'].every(role=>h?.[role]?.connected&&h[role].modelAssessment?.status==='verified')?h:null},90000);
      await click(chat,'Settings');await click(chat,'Health');
      await wait('Health shows both connections',()=>run(chat,`[...document.querySelectorAll('[aria-label^="Sensing server:"],[aria-label^="Tutor agent:"]')].filter(e=>e.getAttribute('aria-label').includes('Connected (service); Connected (model)')).length===2`));
      await capture(chat,'services-connected');log('services-connected',{health});
    }
    log('PASS-'+process.env.COCO_TOUR_STAGE,{state:saved});app.quit();return;
  }
  await capture(chat,'00-getting-started-task');
  await click(chat,'Start Task');
  const game=await wait('user-started Getting Started task',()=>{const w=win('runner-game');return w&&!w.webContents.isLoadingMainFrame()?w:null});game.webContents.setBackgroundThrottling(false);
  let state=await wait('authenticated tutorial state',async()=>{try{return await invoke(chat,'runner-state')}catch{return null}});
  const stage=process.env.COCO_TOUR_STAGE;
  if(stage==='resume'){
    if(state.failure?.kind!=='interrupted'||state.tour!=='active')throw Error('Interrupted tour not restored');
    await capture(chat,'reopened-mid-run');log('reopen-restored',{state});
    await click(chat,'Try again');
    state=await wait('retry publishes',async()=>{await noApproval(chat);const s=await invoke(chat,'runner-state');if(s.error&&s.failure?.kind!=='interrupted')throw Error(s.error);return s.phase==='review'?s:null},150000);
    await capture(game,'reopened-repaired');await click(game,'Leave task');
    log('PASS-reopen',{state,autoApprovals:0});app.quit();return;
  }
  if(state.tour!=='meet')throw Error('Expected Meet Coco on fresh tour');
  await capture(game,'01-meet-coco');
  if(await run(game,`document.body.innerText.includes('Why do you pop up?')`))throw Error('The desktop introduction belongs in onboarding, not the game.');
  if(stage==='skip'){
    await click(game,'Leave task');const skipped=await invoke(chat,'runner-state');if(skipped.tour!=='skipped')throw Error('Skip not saved');
    log('PASS-skip',{state:skipped});app.quit();return;
  }
  await click(game,'Let’s play');
  state=await invoke(chat,'runner-state');if(state.tour!=='active')throw Error('Play did not persist tour');
  await wait('initial gate',()=>run(game,`Boolean([...document.querySelectorAll('button')].find(b=>b.textContent.includes('Make it yours')&&b.disabled))`));
  await capture(game,'02-play');
  let f=await gameFrame(game);
  await f.executeJavaScript(`dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}));`);
  await wait('real game over unlocks customization',async()=>{const s=await invoke(chat,'runner-state');return s.firstGameOver},20000);
  await capture(game,'03-game-over');
  await click(game,'Make it yours');
  await wait('owned game composer',()=>run(chat,`document.body.innerText.includes('Coco already has access')&&document.querySelectorAll('[data-runner-prompt]').length===3&&document.querySelector('textarea[aria-label="Message Coco"]')?.value===''`));
  await capture(chat,'04-chat');
  const suggested=[{id:'suggested-daylight',prompt:'Change it to a daylight game!'},{id:'flying',prompt:'Make a flying version, so I can fly, not just jump.'},{id:'cat-snow',prompt:'Make the fox a cat running through a snowy night.'}];
  const free=require('./game-theme-prompts.json').filter(p=>['daylight','nov7-theme','nov7-background','cuter','dog-bones','harder','ambitious-cat','sunset','misspelled-day','misspelled-cat-snow','score-sounds'].includes(p.id));
  let prompts=stage==='interrupt'?[{id:'interrupt',prompt:'Make a detailed daylight world with a cat and snow'}]:[...suggested,...free];
  if(process.env.COCO_TOUR_IDS)prompts=prompts.filter(p=>process.env.COCO_TOUR_IDS.split(',').includes(p.id));
  if(process.env.COCO_TOUR_LIMIT)prompts=prompts.slice(0,Number(process.env.COCO_TOUR_LIMIT));
  for(const [index,item] of prompts.entries()){
    if(index){
      state=(await invoke(chat,'runner-action',{sessionId:state.sessionId,action:'new-game'})).state;
      await invoke(chat,'runner-action',{sessionId:state.sessionId,action:'customize'});
    }
    await wait('empty composer',()=>run(chat,`document.querySelector('textarea[aria-label="Message Coco"]')?.value===''`));
    const before=sources(state).theme;
    const suggestedIndex=suggested.findIndex(p=>p.id===item.id);
    if(suggestedIndex>=0&&stage!=='interrupt')await run(chat,`document.querySelector('[data-runner-prompt="${suggestedIndex}"]').click()`);
    else {await run(chat,`document.querySelector('textarea[aria-label="Message Coco"]').focus()`);await chat.webContents.insertText(item.prompt);}
    if(index===0&&stage!=='interrupt'){
      await click(chat,'Check my understanding');await wait('inline model understanding',()=>run(chat,`Boolean(document.querySelector('.game-idea-check-result'))||document.body.innerText.includes('Here’s how I understand')`),45000).catch(async error=>{await capture(chat,'understanding-failure');throw error});
      await capture(chat,'05-understanding');
    }
    const started=Date.now();await click(chat,'Send');
    if(stage==='interrupt'){
      await wait('real run starts',async()=>{const s=await invoke(chat,'runner-state');return s.phase==='building'});await capture(chat,'mid-run');log('interrupted',{state:await invoke(chat,'runner-state')});app.quit();return;
    }
    try{
      let captured=false;
      state=await wait('validated publish',async()=>{await noApproval(chat);const s=await invoke(chat,'runner-state');if(s.error)throw Error(s.error);if(s.phase==='building'&&!captured){captured=true;await capture(chat,'working-'+item.id)}return s.phase==='review'&&s.hasChanges?s:null},150000);
      const seconds=+((Date.now()-started)/1000).toFixed(2);const {theme,behavior}=sources(state);assertChange(item.id,theme,before,behavior);
      await wait('preview publication',()=>run(game,`document.querySelector('iframe')?.srcdoc.includes(${JSON.stringify(state.version)})&&document.body.innerText.includes('Updated by Coco')`));
      await capture(game,item.id);await capture(chat,item.id+'-chat');
      if(item.id==='flying'){
        f=await gameFrame(game);await f.executeJavaScript(`globalThis.__cocoGame.reset();dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}))`);await sleep(450);
        const held=await f.executeJavaScript('globalThis.__cocoGame.state().y');await f.executeJavaScript(`dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}))`);await sleep(900);const released=await f.executeJavaScript('globalThis.__cocoGame.state().y');
        if(!(held>30&&released<held))throw Error('Actual held/released flight failed');log('flight',{held,released});
      }
      results.push({...item,success:true,seconds,changed:diff(before,theme),theme,screenshot:item.id+'.png'});
      if(index===0){
        const published=state.version;await click(game,'Undo change');const undone=await wait('undo state',async()=>{const s=await invoke(chat,'runner-state');return s.version!==published?s:null});if(undone.hasChanges||undone.version===published)throw Error('Undo did not restore original');await capture(game,'06-undo');log('undo-verified',{state:undone});
        // Finish the tour with a second real published change, retaining this run's undo evidence.
        await click(game,'Make it yours');await wait('empty composer',()=>run(chat,`document.querySelector('textarea[aria-label="Message Coco"]')?.value===''`));
        await run(chat,`document.querySelector('[data-runner-prompt="0"]').click()`);await click(chat,'Send');
        state=await wait('second actual publication',async()=>{await noApproval(chat);const s=await invoke(chat,'runner-state');if(s.error)throw Error(s.error);return s.phase==='review'&&s.hasChanges?s:null},150000);
        await click(game,'Looks good');await wait('wrap-up',()=>run(game,`document.body.innerText.includes('Your idea. Coco made it happen.')`));await capture(game,'07-done');const finishBubble=win('avatar-bubble');if(finishBubble)await capture(finishBubble,'07-done-bubble');
        await click(game,'Finish task');const finished=await invoke(chat,'runner-state');if(finished.tour!=='finished')throw Error('Finish not saved');if(!(await invoke(chat,'getting-started-status')).complete)throw Error('Getting Started was not checked off');
        await wait('completed task card',()=>run(chat,`Boolean(document.querySelector('.getting-started-task.is-complete'))`));await capture(chat,'08-task-completed');log('tour-complete',{state:finished});
      }
    }catch(error){results.push({...item,id:item.id+'-walkthrough',success:false,seconds:(Date.now()-started)/1000,error:String(error)});await capture(chat,'failed-'+item.id);}
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));log('prompt-result',{...results.at(-1),theme:undefined});
  }
  failed=results.some(r=>!r.success);log(failed?'FAIL-prompts':'PASS',{count:results.length,autoApprovals:0});app.quit();
 }catch(error){failed=true;log('FAIL',{error:String(error.stack||error)});for(const [v,n]of [['runner-game','failure-game'],['session','failure-chat'],['onboarding','failure-setup']]){const w=win(v);if(w)try{await capture(w,n)}catch{}}app.quit();}
});
