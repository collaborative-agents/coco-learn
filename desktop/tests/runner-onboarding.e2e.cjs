/* Real Electron-window/IPC smoke test. No service, provider, or agent mocks. */
const {app,BrowserWindow}=require('electron');
let failed=false;
app.on('will-quit',()=>{if(failed)app.exit(1)});
const pointerEvents=[];app.on('web-contents-created',(_event,contents)=>contents.on('ipc-message',(_event,channel,value)=>{if(channel==='avatar-bubble-pointer')pointerEvents.push({id:contents.id,inside:value?.inside})}));
const fs=require('fs'),path=require('path'),cp=require('child_process');
const output=process.env.COCO_E2E_OUTPUT || path.resolve('..','artifacts','bugfix-verification');
fs.mkdirSync(output,{recursive:true});
const evidence=[];
function record(step,data){const event={at:new Date().toISOString(),step,...data};evidence.push(event);fs.writeFileSync(path.join(output,'events.json'),JSON.stringify(evidence,null,2));console.log('E2E',JSON.stringify(event))}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(label,fn,timeout=30000){const deadline=Date.now()+timeout;let last;while(Date.now()<deadline){try{const value=await fn();if(value)return value}catch(e){if(e.message.startsWith('Real agent failed:'))throw e;last=e.message}await sleep(200)}throw Error(label+' timed out'+(last?': '+last:''))}
function windowFor(view){return BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents.getURL().includes('view='+view))}
async function invoke(win,channel,payload){return win.webContents.executeJavaScript(`window.electron.ipcRenderer.invoke(${JSON.stringify(channel)},${JSON.stringify(payload??null)})`,true)}
async function capture(win,name){if(!win||win.isDestroyed())throw Error('Missing window for '+name);const image=await win.webContents.capturePage();fs.writeFileSync(path.join(output,name+'.png'),image.toPNG());record(name,{visible:win.isVisible(),url:win.webContents.getURL(),bounds:win.getBounds()})}
async function click(win,label){
  const rect=await win.webContents.executeJavaScript(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('aria-label')===${JSON.stringify(label)}||x.textContent.trim()===${JSON.stringify(label)})&&x.getClientRects().length);if(!b)throw Error('No visible button: '+${JSON.stringify(label)});if(b.disabled)throw Error('Button is disabled');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`,true);
  if(win.webContents.getURL().includes('view=avatar-bubble')) {
    // Companion windows deliberately cannot focus. Electron sendInputEvent
    // requires focus; dispatch DOM input through the real renderer instead.
    const pointerCount=pointerEvents.length;
    await win.webContents.executeJavaScript(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});const opts={bubbles:true,clientX:${rect.x},clientY:${rect.y},screenX:${rect.x},screenY:${rect.y}};b.dispatchEvent(new MouseEvent('mouseover',opts));b.dispatchEvent(new MouseEvent('mousemove',opts));})()`,true);
    await sleep(150);
    if(!pointerEvents.slice(pointerCount).some(e=>e.id===win.webContents.id&&e.inside===true))throw Error('Bubble never enabled native pointer input');
    await win.webContents.executeJavaScript(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(label)});if(getComputedStyle(b).pointerEvents==='none')throw Error('Bubble button remains click-through');b.click();})()`,true);
    record('companion-action-input',{label,method:'DOM input in non-focusable companion; real IPC action'});
  } else {
    win.show();win.focus();win.webContents.sendInputEvent({type:'mouseMove',...rect});await sleep(120);win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...rect});win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...rect});
  }
  await sleep(250);
}
app.whenReady().then(async()=>{
  try{
    const chat=await waitFor('chat renderer',()=>{const w=windowFor('session');return w&&!w.webContents.isLoadingMainFrame()?w:null});
    const health=await waitFor('both services and real models',async()=>{const h=await invoke(chat,'get-service-health',{forceModelTest:false});return h?.sensing?.connected&&h?.tutor?.connected&&h.sensing.modelAssessment?.status==='verified'&&h.tutor.modelAssessment?.status==='verified'?h:null},45000);
    record('services-connected',{health});
    await click(chat,'Settings');await click(chat,'Health');
    await waitFor('visible healthy service/model labels',()=>chat.webContents.executeJavaScript(`(document.querySelector('#settings-page-health')?.innerText.match(/Connected \\(model\\)/g)||[]).length===2`),12000);
    await capture(chat,'01-services-connected');
    if(process.env.COCO_E2E_RECOVERY){
      const services=process.env.COCO_E2E_RECOVERY==='both'?['sensing','tutor']:['sensing'];
      for(const name of services){
        const port=process.env[name==='sensing'?'SENSING_PORT':'TUTOR_PORT'];
        const pid=Number(cp.execFileSync('/usr/sbin/lsof',['-tiTCP:'+port,'-sTCP:LISTEN'],{encoding:'utf8'}).trim().split('\n')[0]);
        process.kill(pid,'SIGKILL');record('service-killed-for-recovery-test',{name,pid,port});
        const recovered=await waitFor('automatic '+name+' recovery',async()=>{const h=await invoke(chat,'get-service-health',{forceModelTest:false});return h?.[name]?.connected?h:null},35000);
        record('service-recovered',{name,health:recovered});
      }
    }
    if(process.env.COCO_E2E_STAGE==='services'){record('PASS',{stage:'services'});app.quit();return}
    if(process.env.COCO_E2E_STAGE==='reopen'){
      const state=await invoke(chat,'runner-state');
      const previous=JSON.parse(fs.readFileSync(path.join(output,'..','final','events.json'),'utf8')).find(e=>e.step==='PASS'&&e.stage==='full')?.state;
      if(!previous||state?.phase!=='complete'||state.version!==previous.version||!state.hasChanges)throw Error('Completed custom game did not survive restart');
      await invoke(chat,'runner-action',{sessionId:state.sessionId,action:'open-game'});
      const restored=await waitFor('restored game window',()=>windowFor('runner-game'));
      await waitFor('saved game preview',()=>restored.webContents.executeJavaScript(`Boolean(document.querySelector('iframe')?.srcdoc.includes(${JSON.stringify(state.version)}))`));
      await sleep(500);await capture(restored,'11-restored-custom-game');
      chat.close();if(chat.isVisible()||chat.isDestroyed())throw Error('Close did not preserve the chat');
      await chat.webContents.executeJavaScript(`window.electron.ipcRenderer.sendMessage('open-main-window')`);
      await waitFor('chat reopens',()=>chat.isVisible());
      await capture(chat,'12-chat-reopened');record('PASS',{stage:'reopen',state});app.quit();return;
    }
    await click(chat,'Training tasks');await click(chat,'Start Task');
    await waitFor('game canvas',()=>chat.webContents.executeJavaScript(`Boolean(document.querySelector('iframe[title="Your playable game"]'))`));
    await capture(chat,'02-base-game');
    if(process.env.COCO_E2E_STAGE==='permissions'){
      await waitFor('edit ready',()=>chat.webContents.executeJavaScript(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Make it yours'&&!b.disabled)`));
      await click(chat,'Make it yours');
      await waitFor('composer',()=>chat.webContents.executeJavaScript(`Boolean(document.querySelector('textarea[aria-label="Message Coco"]'))`));
      await chat.webContents.executeJavaScript(`document.querySelector('textarea[aria-label="Message Coco"]').focus()`);
      await chat.webContents.insertText('Change only the sky color to light blue #8fd3ff. Keep everything else unchanged.');
      await click(chat,'Send');
      const state=await waitFor('publish with default permissions',async()=>{
        if(await chat.webContents.executeJavaScript(`Boolean(document.querySelector('[data-pending-permission]'))`))throw Error('Unexpected permission prompt; no auto-approval is allowed');
        const state=await invoke(chat,'runner-state');if(state?.error)throw Error('Real agent failed: '+state.error);return state?.phase==='review'?state:null;
      },145000);
      await capture(windowFor('runner-game'),'default-permissions-game');record('PASS',{stage:'default-permissions',state,autoApprovals:0});app.quit();return;
    }
    if(process.env.COCO_E2E_STAGE==='direct-entry'){
      await waitFor('persistent edit button ready',()=>chat.webContents.executeJavaScript(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Make it yours'&&!b.disabled)`));
      await click(chat,'Make it yours');
      await waitFor('editing composer',()=>chat.webContents.executeJavaScript(`document.querySelector('textarea[aria-label="Message Coco"]')?.value===''&&Boolean(document.querySelector('.agent-folder'))`));
      await capture(chat,'direct-edit-composer');
      const game=await waitFor('game window',()=>windowFor('runner-game'));
      await waitFor('game edit button ready',()=>game.webContents.executeJavaScript(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Make it yours'&&!b.disabled)`));
      await capture(game,'persistent-game-edit-button');
      chat.show();chat.focus();await chat.webContents.executeJavaScript(`document.querySelector('textarea[aria-label="Message Coco"]').focus()`);
      await chat.webContents.insertText('Make it a sunny morning');
      await click(game,'Make it yours');
      const draft=await chat.webContents.executeJavaScript(`document.querySelector('textarea[aria-label="Message Coco"]').value`);
      if(draft!=='Make it a sunny morning')throw Error('Reopening customization lost the draft');
      const state=await invoke(chat,'runner-state');if(state.phase!=='writing')throw Error('Direct editing did not start');
      await capture(chat,'retained-edit-draft');record('PASS',{stage:'direct-entry',state,draftRetained:true});app.quit();return;
    }
    const bubble=await waitFor('Coco introductory bubble',()=>{const w=windowFor('avatar-bubble');return w?.isVisible()?w:null});
    await capture(bubble,'03-first-bubble');const wasVisible=chat.isVisible();await click(bubble,'Try it');
    record('first-bubble-action',{chatVisibleBefore:wasVisible,chatVisibleAfter:chat.isVisible()});
    if(!chat.isVisible())throw Error('BUG 2 REPRODUCED: clicking the first bubble hid the chat');
    if(process.env.COCO_E2E_STAGE==='first-bubble'){record('PASS',{stage:'first-bubble'});app.quit();return}
    const game=await waitFor('Try it opens playable game window',()=>{const w=windowFor('runner-game');return w?.isVisible()?w:null},5000);
    await waitFor('sandbox game loaded',()=>game.webContents.executeJavaScript(`Boolean(document.querySelector('iframe')?.srcdoc.includes('requestAnimationFrame'))`));
    await capture(game,'03b-playable-game');
    const playingFrame=await waitFor('game canvas frame',()=>game.webContents.mainFrame.framesInSubtree.find(f=>f.url==='about:srcdoc'));
    const foxTop=`(()=>{const c=document.querySelector('canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let top=420;for(let y=0;y<342;y++)for(let x=100;x<200;x++){const i=(y*960+x)*4;if(d[i]===245&&d[i+1]===161&&d[i+2]===94)top=Math.min(top,y)}return top})()`;
    const standing=await playingFrame.executeJavaScript(foxTop);
    game.focus();game.webContents.focus();await sleep(250);
    const nativeFocus=game.isFocused();
    const inputMethod='DOM keyboard input in the actual sandbox canvas';
    record('game-focus',{native:nativeFocus,frame:await playingFrame.executeJavaScript('document.hasFocus()'),active:await playingFrame.executeJavaScript('document.activeElement?.tagName')});
    await playingFrame.executeJavaScript(`document.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));document.querySelector('canvas').dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}));`);
    await sleep(180);const jumping=await playingFrame.executeJavaScript(foxTop);
    record('immediate-keyboard-play',{standing,jumping,inputMethod});if(jumping>=standing-10)throw Error('Space did not make the fox jump immediately');
    await capture(game,'03c-keyboard-jump');
    // First round is real gameplay. Waiting without jumping produces a real hit.
    await waitFor('first game over invitation',async()=>{const w=windowFor('avatar-bubble');return w&&await w.webContents.executeJavaScript(`document.body.innerText.includes('Make it mine')||document.body.innerText.includes('Make it yours')`)?w:null},25000);
    await capture(bubble,'04-game-over-invitation');
    const text=await bubble.webContents.executeJavaScript('document.body.innerText');
    await click(bubble,text.includes('Make it yours')?'Make it yours':'Make it mine');
    await waitFor('real composer with game workspace',()=>chat.webContents.executeJavaScript(`document.querySelector('textarea[aria-label="Message Coco"]')?.value==='' && Boolean(document.querySelector('.agent-folder'))`));
    await capture(chat,'05-empty-agent-composer');
    if(process.env.COCO_E2E_STAGE==='handoff'){record('PASS',{stage:'handoff'});app.quit();return}
    const initial=await invoke(chat,'runner-state');
    const initialPreview=await invoke(chat,'runner-preview');
    const prompt='Make it a bright sunny morning with a golden sun and a light blue sky. Keep the fox and controls the same.';
    chat.show();chat.focus();
    await chat.webContents.executeJavaScript(`document.querySelector('textarea[aria-label="Message Coco"]').focus()`);
    await chat.webContents.insertText(prompt);
    await waitFor('draft coaching bubble',()=>bubble.webContents.executeJavaScript(`document.body.innerText.includes('IDEA')`),8000);
    await capture(chat,'06-own-prompt');await capture(bubble,'06b-draft-coaching');
    record('own-prompt',{prompt});
    await click(chat,'Check my understanding');
    await waitFor('real model interpretation',()=>bubble.webContents.executeJavaScript(`document.body.innerText.includes('DID I GET IT?')`),40000);
    const retained=await chat.webContents.executeJavaScript(`document.querySelector('textarea[aria-label="Message Coco"]').value`);
    if(retained!==prompt)throw Error('Understanding check lost the draft');
    await capture(bubble,'06c-understanding-check');
    await click(chat,'Send');
    let progressCaptured=false;
    const built=await waitFor('real agent builds and validates game',async()=>{
      const state=await invoke(chat,'runner-state');
      const permission=await chat.webContents.executeJavaScript(`(()=>{const card=document.querySelector('[data-pending-permission]');if(!card)return null;const b=card.querySelector('.agent-permission-allow');return b&&!b.disabled?{label:b.textContent.trim(),text:card.innerText}:null})()`);
      if(permission)throw Error('Unexpected tutorial permission prompt (test never auto-approves): '+permission.text);
      if(state?.phase==='building'&&!progressCaptured){await capture(chat,'07-agent-working');progressCaptured=true}
      if(state?.error)throw Error('Real agent failed: '+state.error);
      return state?.phase==='review'&&state.version!==initial.version?state:null;
    },155000);
    const custom=await invoke(chat,'runner-preview');
    if(custom.html===initialPreview.html)throw Error('Agent published unchanged game');
    record('agent-published-actual-changes',{beforeVersion:initial.version,afterVersion:built.version});
    const customGame=windowFor('runner-game');
    await waitFor('updated preview rendered',()=>customGame.webContents.executeJavaScript(`Boolean(document.querySelector('iframe')?.srcdoc.includes(${JSON.stringify(built.version)}))`));
    await sleep(700);await capture(customGame,'08-custom-game');await capture(bubble,'08b-custom-game-bubble');await capture(chat,'08c-agent-result');
    const gameFrame=customGame.webContents.mainFrame.framesInSubtree.find(f=>f.url==='about:srcdoc');
    if(!gameFrame)throw Error('Missing playable game frame');
    const before=await gameFrame.executeJavaScript(`document.querySelector('canvas').toDataURL()`);
    await sleep(500);
    const after=await gameFrame.executeJavaScript(`document.querySelector('canvas').toDataURL()`);
    if(before===after)throw Error('Updated game did not advance');
    record('custom-game-animation',{changed:true});
    await click(customGame,'Looks good');await capture(bubble,'09-wrap-up');
    await click(bubble,'Continue');
    await capture(chat,'10-training-complete');
    const final=await invoke(chat,'runner-state');if(final.phase!=='complete')throw Error('Tutorial did not complete');
    record('PASS',{stage:'full',state:final});app.quit();
  }catch(error){failed=true;record('FAIL',{message:error.stack});for(const w of BrowserWindow.getAllWindows()){if(!w.isDestroyed())await capture(w,'failure-window-'+w.id).catch(()=>{})}process.exitCode=1;app.quit()}
});
