/* Real artist + independent vision review in disposable workspaces; denies approvals. */
const {app}=require('electron');
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process'),{pathToFileURL}=require('url');
require('ts-node').register({transpileOnly:true,compilerOptions:{module:'commonjs',moduleResolution:'node'}});
const {applyThemePatch,validateTheme,validatePlayerArtwork,themeSchema}=require('../src/main/game/theme-data');
const {designCharacter}=require('../src/main/game/character-artist');
const {captureCharacterArt}=require('../src/main/game/art-evidence');
const {reviewCharacterArt}=require('../src/main/game/art-review');
const {gameHtml}=require('../src/main/game/preview');
const validate=require('../src/main/game/browser-validator').default;
const original=require('../src/main/game/theme.json');
const template=require('../src/shared/runner-template.json');
const out=process.env.COCO_ART_OUTPUT||path.resolve(__dirname,'../../artifacts/custom-art-review');fs.mkdirSync(out,{recursive:true});
const root=fs.mkdtempSync(path.join(app.getPath('temp'),'coco-custom-art-'));app.setPath('userData',root);
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 const results=[];let token;
 try {
  // Reuse only the existing local bridge credential; never print process environments.
  const pid=execFileSync('lsof',['-tiTCP:8081','-sTCP:LISTEN'],{encoding:'utf8'}).trim().split('\n')[0];
  const env=execFileSync('ps',['eww','-p',pid,'-o','command='],{encoding:'utf8'});
  token=env.match(/(?:^|\s)COCO_PI_BRIDGE_TOKEN=([^\s]+)/)?.[1];if(!token)throw Error('Local bridge credential unavailable');
  const url='http://127.0.0.1:8081',headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  const call=async(route,body)=>{const r=await fetch(url+'/agent/'+route,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Bridge HTTP '+r.status);return r.json()};
  const foreground=await call('context');
  const {createRuntime}=await import(pathToFileURL(path.resolve(__dirname,'../release/app/agent/pi-runtime.mjs')).href);
  for(const animal of (process.env.COCO_ART_CASES||'turtle,robot').split(',')){
   const start=Date.now(),sessionId='art-test-'+animal+'-'+Date.now(),cwd=path.join(root,animal);fs.mkdirSync(cwd,{recursive:true});
   for(const [name,source] of Object.entries(template))fs.writeFileSync(path.join(cwd,name),source);
   const context=await call('sessions/'+sessionId,{model:foreground.model,scenario:'everyday_support'});
   context.instructions=template['GUIDE.md'];context.history=[];context.tools=[];context.profile='';
   const request=`Make the runner an original detailed ${animal}, with the same polish and scale as Coco. Draw custom art; do not substitute a preset animal. Keep the scenery and rules.`;
   const getTheme=()=>JSON.parse(fs.readFileSync(path.join(cwd,'theme.json'),'utf8'));
   const getHtml=()=>gameHtml(template['engine.js'],fs.readFileSync(path.join(cwd,'behavior.js'),'utf8'),getTheme(),'art-test');
   const inspect=()=>captureCharacterArt(getHtml(),getTheme());
   if(process.env.COCO_ART_REVIEW_ONLY){
    const evidence=await inspect();
    const verdict=await reviewCharacterArt(url,token,sessionId,request,evidence);
    for(const [name,data] of Object.entries({contactSheet:evidence.contactSheet,scene:evidence.scene}))fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data.split(',')[1],'base64'));
    fs.writeFileSync(path.join(out,'negative-control.json'),JSON.stringify(verdict,null,2));
    console.log(JSON.stringify({negativeControl:!verdict.pass,verdict}));
    await fetch(url+'/agent/sessions/'+sessionId,{method:'DELETE',headers,signal:AbortSignal.timeout(5000)});
    app.exit(verdict.pass?1:0);return;
   }
   let approvals=0,previews=0,runtime;
   const checks=[];let error=null;
   try {
    runtime=await createRuntime({cwd,sessionId,dataDir:root,tutorUrl:url,token,context,toolMode:'game',gameSchema:themeSchema,
     requestApproval:async()=>{approvals++;throw Error('Test never approves commands');},requestWorkspaceAccess:async()=>true /* Same pre-authorized app-owned workspace as PiHarness; external paths still require denied approval. */,
     designGameCharacter:async description=>{const theme=await designCharacter(url,token,sessionId,request+'\n'+description,getTheme(),await inspect());fs.writeFileSync(path.join(cwd,'theme.json'),JSON.stringify(theme));return {ok:true,name:theme.player.name}},
     inspectGameArtwork:async()=>{previews++;const evidence=await inspect();const review=await reviewCharacterArt(url,token,sessionId,request,evidence);return {...evidence,description:JSON.stringify(review)}},updateGameTheme:changes=>{const next=applyThemePatch(getTheme(),changes);validatePlayerArtwork(original,next,request);fs.writeFileSync(path.join(cwd,'theme.json'),JSON.stringify(next));return {ok:true};}});
    runtime.subscribe(event=>{if(event.type==='tool_execution_end')console.log(JSON.stringify({animal,tool:event.toolName,error:!!event.isError,detail:event.isError?event.result:undefined}));});
    let prompt=request;
    for(let attempt=0;attempt<3;attempt++){
     let timer;try{await Promise.race([runtime.prompt(prompt,[],context),new Promise((_,reject)=>{timer=setTimeout(()=>{runtime.abort();reject(Error('Artist timed out after 240 seconds'))},Math.max(1,240000-(Date.now()-start)))})]);}finally{clearTimeout(timer)}
     try{
      if(JSON.stringify(getTheme().player.frames)===JSON.stringify(original.player.frames))throw Error('The custom character was not applied');
      validateTheme(getTheme());validatePlayerArtwork(original,getTheme(),request);await validate(getHtml());
      const evidence=await inspect();
      for(const [name,data] of Object.entries({contactSheet:evidence.contactSheet,scene:evidence.scene}))fs.writeFileSync(path.join(out,`${animal}-${attempt}-${name}.png`),Buffer.from(data.split(',')[1],'base64'));
      const verdict=await reviewCharacterArt(url,token,sessionId,request,evidence);checks.push(verdict);fs.writeFileSync(path.join(out,`${animal}-${attempt}-review.json`),JSON.stringify(verdict,null,2));
      if(verdict.pass){error=null;break;}
      throw Error(verdict.defects.join('; '));
     }catch(e){error=e.message;checks.push({diagnostic:error});prompt=`Original request: ${request}\nThe app review found: ${error}. Inspect the art and repair these defects. Do not run shell commands.`;}
    }
   }catch(e){error=e.message;}finally{runtime?.dispose();await fetch(url+'/agent/sessions/'+sessionId,{method:'DELETE',headers,signal:AbortSignal.timeout(5000)}).catch(()=>{});}
   if(!error && Date.now()-start>240000)error='Exceeded the app’s four-minute custom-art budget';
   const result={animal,success:!error,seconds:(Date.now()-start)/1000,approvals,previews,checks,error};results.push(result);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(result));
  }
  app.exit(results.every(r=>r.success)?0:1);
 }catch(e){console.error(e.message);app.exit(1)}
});
