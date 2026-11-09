/* Full real-model onboarding. Default permissions. Never answers an approval. */
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const out = process.env.COCO_POLISH_OUTPUT || path.resolve('artifacts/game-polish/live');
fs.mkdirSync(out, { recursive: true });
const events=[], results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function bounded(label, promise, ms=10000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' timed out')),ms)})]);}finally{clearTimeout(timer)}}
const win=view=>BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents.getURL().includes('view='+view));
const invoke=(w,c,p)=>bounded(c,w.webContents.executeJavaScript(`window.electron.ipcRenderer.invoke(${JSON.stringify(c)},${JSON.stringify(p??null)})`,true));
function log(step,data={}){events.push({at:new Date().toISOString(),step,...data});fs.writeFileSync(path.join(out,'events.json'),JSON.stringify(events,null,2));console.log('POLISH',JSON.stringify(events.at(-1)));}
async function wait(label,fn,ms=30000){const end=Date.now()+ms;while(Date.now()<end){const r=await bounded(label,fn(),Math.min(10000,end-Date.now()));if(r)return r;await sleep(100)}throw Error(label+' timed out');}
async function click(w,label){
  log('click',{label,view:w.webContents.getURL().split('view=')[1]});
  if(w.webContents.getURL().includes('avatar-bubble')){
    await w.webContents.executeJavaScript(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(b){b.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,screenX:150,screenY:150}));b.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,screenX:150,screenY:150}));}})()`);await sleep(150);
  }
  const result=await w.webContents.executeJavaScript(`(()=>{const buttons=[...document.querySelectorAll('button')];const b=buttons.find(b=>(b.getAttribute('aria-label')===${JSON.stringify(label)}||b.textContent.trim()===${JSON.stringify(label)})&&b.getClientRects().length);if(!b||b.disabled)return {error:'Missing enabled button',buttons:buttons.map(b=>b.textContent.trim()),body:document.body.innerText};b.click();return {ok:true}})()`);
  if(!result.ok)throw Error(label+': '+JSON.stringify(result));await sleep(150);
}
async function capture(w,name){log('capture',{name});w.webContents.setBackgroundThrottling(false);await sleep(200);fs.writeFileSync(path.join(out,name+'.png'),(await bounded('capture '+name,w.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}),8000)).toPNG());}
async function frame(game){return wait('actual game frame',()=>{const f=game.webContents.mainFrame.framesInSubtree.find(f=>f.url==='about:srcdoc');return f?.executeJavaScript('Boolean(globalThis.__cocoGame)').then(ok=>ok?f:null)});}
async function noApproval(chat){if(await chat.webContents.executeJavaScript(`Boolean(document.querySelector('[data-pending-permission]'))`))throw Error('Unexpected approval: test never answers approvals');}
function themeFor(state){const root=path.join(app.getPath('userData'),'runner-tutorial');const u=fs.readdirSync(root).find(u=>fs.existsSync(path.join(root,u,state.sessionId)));const folder=path.join(root,u,state.sessionId,'work');return {theme:JSON.parse(fs.readFileSync(path.join(folder,'theme.json'),'utf8')),behavior:fs.readFileSync(path.join(folder,'behavior.js'),'utf8')};}
app.whenReady().then(async()=>{
  try{
    const chat=await wait('chat',()=>{const w=win('session');return w&&!w.webContents.isLoadingMainFrame()?w:null},40000);chat.webContents.setBackgroundThrottling(false);
    await wait('services and models',async()=>{let h;try{h=await invoke(chat,'get-service-health',{})}catch{return false}return h?.sensing?.connected&&h?.tutor?.connected&&h.sensing.modelAssessment?.status==='verified'&&h.tutor.modelAssessment?.status==='verified'?h:null},60000);
    log('services-and-models-connected');
    const prompts=['Change it to a daylight game!','Make a flying version, so I can fly, not just jump.','Make the fox a cat running through a snowy night.'];
    const prior=await invoke(chat,'runner-state');
    if(process.env.COCO_POLISH_MODE==='reopen'){
      const expected=JSON.parse(fs.readFileSync(path.join(out,'..','live','results.json'))).at(-1);
      if(prior.phase!=='complete'||prior.version!==expected.version)throw Error('Completed game did not survive restart');
      await invoke(chat,'runner-action',{sessionId:prior.sessionId,action:'open-game'});const game=await wait('restored game',()=>win('runner-game'));await frame(game);await capture(game,'restored-custom-game');log('PASS-reopen',{state:prior});app.quit();return;
    }
    let previous=prior;
    for(let index=0;index<prompts.length;index++){
      if(previous)await invoke(chat,'runner-action',{sessionId:previous.sessionId,action:'new-game'});
      await click(chat,'Training tasks');
      await click(chat,'Start Task');
      const game=await wait('Start Task directly opens native game',()=>win('runner-game'),10000);game.webContents.setBackgroundThrottling(false);
      let f=await frame(game);
      const bubble=await wait('intro bubble',async()=>{const w=win('avatar-bubble');return w?.isVisible()&&await w.webContents.executeJavaScript(`document.body.innerText.includes('simple little game')`)?w:null});
      const avatar=BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&!w.webContents.getURL().includes('view=')&&w.webContents.getURL().includes('index.html'));
      if(!avatar?.isVisible())throw Error('Floating Coco avatar is missing');
      if(index===0){await capture(game,'01-native-game');await capture(bubble,'02-introduction');await capture(avatar,'02-avatar');}
      await click(bubble,'Let’s play');
      await wait('play invitation',()=>bubble.webContents.executeJavaScript(`document.body.innerText.includes('Play the game')&&document.body.innerText.includes('Make it yours')`));
      await wait('game unpaused',()=>f.executeJavaScript('globalThis.__cocoGame.state().time>0'));
      await f.executeJavaScript(`dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}));`);
      await sleep(150);
      const y=await f.executeJavaScript('globalThis.__cocoGame.state().y');if(y<5)throw Error('Original game did not jump');
      log('play-original',{index,jumpHeight:y});
      await wait('actual game over',()=>f.executeJavaScript('globalThis.__cocoGame.state().over'),25000);
      if(index===0){await capture(game,'03-game-over');await capture(bubble,'03-remix-invitation');}
      await click(game,'Make it yours');
      await wait('chat greeting and empty composer',()=>chat.webContents.executeJavaScript(`document.body.innerText.includes('What do you want to change about your game?')&&document.querySelector('textarea[aria-label="Message Coco"]')?.value===''&&document.querySelectorAll('[data-runner-prompt]').length===3`));
      await noApproval(chat);
      if(index===0)await capture(chat,'04-chat-and-suggestions');
      const before=await invoke(chat,'runner-state');
      await chat.webContents.executeJavaScript(`document.querySelector('[data-runner-prompt="${index}"]').click()`);
      await wait('suggestion inserted, not auto-sent',()=>chat.webContents.executeJavaScript(`document.querySelector('textarea[aria-label="Message Coco"]').value===${JSON.stringify(prompts[index])}`));
      if((await invoke(chat,'runner-state')).phase==='building')throw Error('Suggestion was sent automatically');
      await capture(chat,`${index+1}-prompt-inserted`);
      const start=Date.now();await click(chat,'Send');let working=false;
      const state=await wait('real model edit and published game',async()=>{await noApproval(chat);const s=await invoke(chat,'runner-state');if(s.error)throw Error(s.error);if(s.phase==='building'&&!working){working=true;await capture(chat,`${index+1}-agent-working`)}return s.phase==='review'&&s.version!==before.version?s:null},150000);
      const seconds=+((Date.now()-start)/1000).toFixed(2);
      await wait('chat completes',()=>chat.webContents.executeJavaScript(`![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Stop')`));
      await wait('correct preview version',()=>game.webContents.executeJavaScript(`document.querySelector('iframe')?.srcdoc.includes(${JSON.stringify(state.version)})&&document.querySelector('header')?.innerText.includes('Updated game')`));f=await frame(game);
      const {theme,behavior}=themeFor(state);let flight;
      if(index===0&&(!['morning','day'].includes(theme.timeOfDay)||/moonlit/i.test(theme.title)))throw Error('Daylight theme/title not applied');
      if(index===1){
        if(theme.controls?.mode!=='fly'||!behavior.includes('jumpHeld'))throw Error('Flying behavior was not installed');
        await f.executeJavaScript(`globalThis.__cocoGame.reset();globalThis.__cocoGame.state().spawn=Infinity;dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}))`);
        await sleep(500);const held=await f.executeJavaScript('globalThis.__cocoGame.state().y');
        await capture(game,'05-flying-held');
        await f.executeJavaScript(`dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}))`);
        await sleep(1100);const released=await f.executeJavaScript('globalThis.__cocoGame.state().y');
        if(held<30||released>=held)throw Error('Held/released flight did not work');
        await f.executeJavaScript(`dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));dispatchEvent(new Event('blur'));`);
        if(await f.executeJavaScript('globalThis.__cocoGame.state().input.jumpHeld'))throw Error('Focus loss left flying input stuck');
        flight={heldHeight:held,releasedHeight:released,blurClearsInput:true};await capture(game,'05-flying-released');
        // Browser-level trusted pointer input exercises actual pointer capture.
        await f.executeJavaScript('globalThis.__cocoGame.reset();globalThis.__cocoGame.state().spawn=Infinity');
        const outer=await game.webContents.executeJavaScript(`(()=>{const r=document.querySelector('iframe').getBoundingClientRect();return {x:r.x,y:r.y}})()`);
        const inner=await f.executeJavaScript(`(()=>{const r=document.querySelector('#jump').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
        const point={x:outer.x+inner.x,y:outer.y+inner.y};
        game.webContents.debugger.attach('1.3');
        try {
          await game.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...point});
          await sleep(500);const up=await f.executeJavaScript('globalThis.__cocoGame.state().y');
          await game.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point});
          await sleep(1100);const down=await f.executeJavaScript('globalThis.__cocoGame.state().y');
          if(up<30||down>=up)throw Error('On-screen Fly button did not rise while pressed and fall after release');
          flight.pointerHeldHeight=up;flight.pointerReleasedHeight=down;
        } finally {game.webContents.debugger.detach();}
      }
      if(index===2&&(!/cat/i.test(theme.player.name)||theme.weather.kind!=='snow'||theme.timeOfDay!=='night'))throw Error('Snowy cat request incomplete');
      await capture(game,`${index+1}-updated-game`);await capture(chat,`${index+1}-agent-result`);await capture(bubble,`${index+1}-coco-summary`);
      await capture(avatar,`${index+1}-avatar`);
      fs.writeFileSync(path.join(out,`${index+1}-windows.json`),JSON.stringify({game:game.getContentBounds(),avatar:avatar.getContentBounds(),bubble:bubble.getContentBounds(),avatarVisible:avatar.isVisible(),bubbleVisible:bubble.isVisible()},null,2));
      const row={prompt:prompts[index],success:true,seconds,version:state.version,flight,theme,screenshot:`${index+1}-updated-game.png`,autoApprovals:0};results.push(row);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));log('published',{prompt:row.prompt,seconds,version:state.version,flight});
      await click(game,'Looks good');await wait('wrap-up',()=>bubble.webContents.executeJavaScript(`document.body.innerText.includes('YOU DID IT')`));
      if(index===2)await capture(bubble,'06-wrap-up');await click(bubble,'Continue');previous=await invoke(chat,'runner-state');if(previous.phase!=='complete')throw Error('Activity did not complete');
      if(index===2)await capture(chat,'07-completed');
    }
    log('PASS-full-session',{suggestions:results.length,autoApprovals:0});app.quit();
  }catch(e){log('FAIL',{error:e.stack});for(const w of BrowserWindow.getAllWindows())if(!w.isDestroyed())await capture(w,'failure-'+w.id).catch(()=>{});app.exit(1);}
});
