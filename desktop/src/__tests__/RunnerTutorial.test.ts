/** @jest-environment node */
import fs from 'fs';import os from 'os';import path from 'path';
import RunnerTutorial from '../main/services/runner-tutorial';
let root:string,tutorial:RunnerTutorial,guide:jest.Mock,changed:jest.Mock,validate:jest.Mock;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'coco-theme-flow-'));guide=jest.fn();changed=jest.fn();validate=jest.fn(async()=>{});tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate});});
afterEach(()=>{tutorial.dispose();fs.rmSync(root,{recursive:true,force:true});});
const begin=(text='make it daylight')=>{const s=tutorial.start('alice');tutorial.writing('alice');tutorial.begin('alice',s.sessionId,jest.fn(),text);return s;};
it('introduces the game in two readable steps and coaches the draft at most three times',()=>{const s=tutorial.start('alice');expect(guide.mock.calls.at(-1)[1].text).toContain('simple little game');expect(guide.mock.calls.at(-1)[1].action).toBe('play');guide.mockClear();tutorial.playing('alice');expect(guide).not.toHaveBeenCalled();tutorial.firstGameOver('alice');expect(guide.mock.calls.at(-1)[1].action).toBe('customize');guide.mockClear();tutorial.writing('alice');for(const draft of ['make it cooler','make it cooler','Change the fox to a cat','A cute pink cat'])tutorial.coach('alice',s.sessionId,draft);expect(guide.mock.calls.length).toBeLessThanOrEqual(3);expect(tutorial.state('bob')).toBeNull();});
it('uses one validated theme update and publishes only after the browser check',async()=>{const s=begin();const original=tutorial.preview('alice')!.html;tutorial.tools('alice',s.sessionId).updateTheme({timeOfDay:'day'});expect(tutorial.state('alice')?.previewKind).toBe('checking');await tutorial.check('alice',s.sessionId);expect(await tutorial.finish('alice',s.sessionId,true)).toBe(true);expect(validate).toHaveBeenCalledTimes(1);expect(tutorial.state('alice')).toMatchObject({phase:'review',hasChanges:true,previewKind:'updated',error:null});expect(tutorial.preview('alice')!.html).not.toBe(original);tutorial.undo('alice');expect(tutorial.preview('alice')!.html).toBe(original);});
it('rejects invalid theme data without changing the last valid preview',()=>{const s=begin();const original=tutorial.preview('alice')!.html;expect(()=>tutorial.tools('alice',s.sessionId).updateTheme({physics:{gravity:-5}})).toThrow();expect(tutorial.preview('alice')!.html).toBe(original);});
it('restores the previous game when browser validation fails',async()=>{const s=begin();const original=tutorial.preview('alice')!.html;tutorial.tools('alice',s.sessionId).updateTheme({timeOfDay:'day'});validate.mockRejectedValue(Error('Behavior hook caused an invalid position'));expect(await tutorial.finish('alice',s.sessionId,true)).toBe(false);expect(tutorial.state('alice')?.failure?.detail).toContain('invalid position');expect(tutorial.preview('alice')!.html).toBe(original);});
it('rejects stable engine edits',async()=>{const s=begin();fs.appendFileSync(path.join(tutorial.workspace('alice',s.sessionId)!,'engine.js'),'\n// edit');expect(await tutorial.finish('alice',s.sessionId,true)).toBe(false);expect(tutorial.state('alice')?.failure?.detail).toContain('stable engine');});
it('keeps a question’s normal answer and treats an unapplied change honestly',async()=>{const s=begin('what would you recommend?');expect(await tutorial.finish('alice',s.sessionId,true)).toBeUndefined();expect(tutorial.state('alice')?.error).toBeNull();tutorial.begin('alice',s.sessionId,jest.fn(),'make it sunny');expect(await tutorial.finish('alice',s.sessionId,true)).toBe(false);expect(tutorial.state('alice')?.failure?.detail).toContain('not applied');});
it('reports the actual cancellation cause without shrinking the request',async()=>{const s=begin();await tutorial.finish('alice',s.sessionId,false,'timeout');expect(tutorial.state('alice')?.failure?.kind).toBe('timeout');expect(tutorial.state('alice')?.error).not.toMatch(/smaller|too big|tiny/);});
it('restores the published game and request after closing mid-run',()=>{const s=begin('make a snowy cat world');const before=tutorial.preview('alice')!.html;tutorial.tools('alice',s.sessionId).updateTheme({timeOfDay:'day'});tutorial.dispose();tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate});expect(tutorial.state('alice')).toMatchObject({phase:'writing',lastRequest:'make a snowy cat world',failure:{kind:'interrupted'}});expect(tutorial.preview('alice')!.html).toBe(before);});
it('keeps the old workspace on disk when starting a fresh benchmark/game',()=>{const s=tutorial.start('alice');const next=tutorial.newGame('alice');expect(next.sessionId).not.toBe(s.sessionId);expect(fs.existsSync(path.join(root,'runner-tutorial','alice',s.sessionId))).toBe(true);});

it('hot-reloads a valid theme file and explains invalid data while retaining the good preview',async()=>{
 const s=tutorial.start('alice');const work=tutorial.workspace('alice',s.sessionId)!;
 const t=JSON.parse(fs.readFileSync(path.join(work,'theme.json'),'utf8'));t.title='My edited theme';fs.writeFileSync(path.join(work,'theme.json'),JSON.stringify(t));
 await new Promise(resolve=>setTimeout(resolve,600));
 expect(tutorial.state('alice')?.hasChanges).toBe(true);const good=tutorial.preview('alice')!.html;
 fs.writeFileSync(path.join(work,'theme.json'),'{ invalid json');await new Promise(resolve=>setTimeout(resolve,600));
 expect(tutorial.state('alice')?.previewError).toContain('last working preview');expect(tutorial.preview('alice')!.html).toBe(good);
});
it('lets the schema tool repair a malformed file from the last working theme',async()=>{const s=begin();const work=tutorial.workspace('alice',s.sessionId)!;fs.writeFileSync(path.join(work,'theme.json'),'{ bad json');tutorial.tools('alice',s.sessionId).updateTheme({timeOfDay:'day'});expect(await tutorial.finish('alice',s.sessionId,true)).toBe(true);});

it('installs actual flight behavior and validates it before publication',async()=>{const s=begin('make a flying version');tutorial.tools('alice',s.sessionId).updateTheme({behaviorPreset:'flight'});const work=tutorial.workspace('alice',s.sessionId)!;expect(fs.readFileSync(path.join(work,'behavior.js'),'utf8')).toContain('state.input.jumpHeld');expect(JSON.parse(fs.readFileSync(path.join(work,'theme.json'),'utf8')).controls.mode).toBe('fly');expect(await tutorial.finish('alice',s.sessionId,true)).toBe(true);});
it('upgrades old visual snapshots without dropping custom art, rules, scores, or originals',()=>{
 const s=tutorial.start('alice');const directory=path.join(root,'runner-tutorial','alice',s.sessionId);const old=path.join(directory,'versions',s.version);
 const theme=JSON.parse(fs.readFileSync(path.join(old,'theme.json'),'utf8'));theme.title='Pippin dash';theme.player.name='My pet';theme.physics.speed=350;theme.spritePalette.o='#1133aa';delete theme.scene;delete theme.controls;
 fs.writeFileSync(path.join(old,'theme.json'),JSON.stringify(theme));const statePath=path.join(root,'runner-tutorial','alice','state.json');const record=JSON.parse(fs.readFileSync(statePath,'utf8'));delete record.visualRevision;record.bestScores={[s.version]:23};fs.writeFileSync(statePath,JSON.stringify(record));tutorial.dispose();
 tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate});const upgraded=tutorial.state('alice')!;expect(upgraded.version).not.toBe(s.version);expect(upgraded.hasChanges).toBe(false);expect(fs.existsSync(old)).toBe(true);expect(fs.existsSync(path.join(directory,'before-visual-upgrade.json'))).toBe(true);
 const next=JSON.parse(fs.readFileSync(path.join(tutorial.workspace('alice',s.sessionId)!,'theme.json'),'utf8'));expect(next.title).toBe('Pippin dash');expect(next.player).toEqual(theme.player);expect(next.physics.speed).toBe(350);expect(next.spritePalette.o).toBe('#1133aa');expect(next.scene.layers).toHaveLength(5);expect(tutorial.preview('alice')!.html).toContain('23');
});
it('does not count undoing all changes as a custom game',async()=>{const s=begin();tutorial.tools('alice',s.sessionId).updateTheme({timeOfDay:'day'});await tutorial.finish('alice',s.sessionId,true);tutorial.undo('alice');expect(tutorial.state('alice')!.hasChanges).toBe(false);expect(()=>tutorial.complete('alice')).toThrow();});

it('persists the tour without replacing an existing account’s game or undo history', async () => {
 const s=begin();tutorial.tools('alice',s.sessionId).updateTheme({timeOfDay:'day'});await tutorial.finish('alice',s.sessionId,true);
 const version=tutorial.state('alice')!.version;
 expect(tutorial.startTour('alice')).toMatchObject({tour:'meet',sessionId:s.sessionId,version,canUndo:true});
 tutorial.tourAction('alice','tour-play');tutorial.dispose();
 tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate});
 expect(tutorial.state('alice')).toMatchObject({tour:'active',version,canUndo:true});
 tutorial.complete('alice');expect(tutorial.state('alice')?.tour).toBe('done');
 tutorial.tourAction('alice','finish-setup');expect(tutorial.state('alice')?.tour).toBe('finished');
});
it('persists skipping at Meet Coco and preserves the original playable game', () => {
 const s=tutorial.startTour('alice');expect(s.tour).toBe('meet');
 expect(()=>tutorial.tourAction('alice','finish-setup')).toThrow();
 tutorial.tourAction('alice','skip-tour');tutorial.dispose();
 tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate});
 expect(tutorial.state('alice')).toMatchObject({tour:'skipped',version:s.version,hasChanges:false});
});
it('records the first game over and limits draft tips to two', () => {
 const s=tutorial.startTour('alice');expect(s.firstGameOver).toBe(false);
 tutorial.tourAction('alice','tour-play');tutorial.firstGameOver('alice');
 expect(tutorial.state('alice')?.firstGameOver).toBe(true);
 tutorial.writing('alice');guide.mockClear();
 for(const draft of ['make it cooler','make the fox a cat in daylight','a purple rabbit at night','please add clouds']) tutorial.coach('alice',s.sessionId,draft);
 expect(guide.mock.calls).toHaveLength(2);
});
it('does not publish a check that finishes after the tour was skipped', async () => {
 const s=tutorial.startTour('alice');tutorial.tourAction('alice','tour-play');tutorial.writing('alice');tutorial.begin('alice',s.sessionId,jest.fn(),'make it daylight');
 tutorial.tools('alice',s.sessionId).updateTheme({timeOfDay:'day'});
 let release!:()=>void;validate.mockImplementation(()=>new Promise<void>(resolve=>{release=resolve}));
 const publishing=tutorial.finish('alice',s.sessionId,true);
 await tutorial.finish('alice',s.sessionId,false,'The tour was skipped.');tutorial.tourAction('alice','skip-tour');
 release();await publishing;
 expect(tutorial.state('alice')).toMatchObject({tour:'skipped',hasChanges:false,version:s.version});
});
it('can publish a validated theme after an optional command is declined, without inventing a failure',async()=>{
 const s=begin();const request={id:'optional',kind:'action' as const,tool:'bash',arguments:{command:'echo optional'},directory:tutorial.workspace('alice',s.sessionId)!,status:'pending' as const};
 tutorial.permission('alice',s.sessionId,request);
 expect(guide.mock.calls.at(-1)[1].text).toContain('timer is paused');
 tutorial.permission('alice',s.sessionId,{...request,status:'denied'});
 tutorial.tools('alice',s.sessionId).updateTheme({timeOfDay:'day'});
 expect(await tutorial.finish('alice',s.sessionId,true)).toBe(true);
 expect(validate).toHaveBeenCalled();expect(tutorial.state('alice')?.error).toBeNull();
});
it('keeps a completed tour completed when starting another game',async()=>{
 const s=tutorial.startTour('alice');tutorial.tourAction('alice','tour-play');tutorial.writing('alice');tutorial.begin('alice',s.sessionId,jest.fn(),'make it daylight');
 tutorial.tools('alice',s.sessionId).updateTheme({timeOfDay:'day'});await tutorial.finish('alice',s.sessionId,true);tutorial.complete('alice');tutorial.tourAction('alice','finish-setup');
 expect(tutorial.newGame('alice')).toMatchObject({tour:'finished',phase:'play',hasChanges:false});
});
it('sends a daylight sky with a moon/night title back for repair instead of publishing it',async()=>{
 const s=begin('hmmm maybe change only the background to daylight !');
 tutorial.tools('alice',s.sessionId).updateTheme({background:{type:'gradient',colors:['#8fd3ff','#eaf7ff']}});
 await expect(tutorial.check('alice',s.sessionId)).rejects.toThrow('still has a night');
 expect(tutorial.state('alice')?.hasChanges).toBe(false);
 tutorial.tools('alice',s.sessionId).updateTheme({timeOfDay:'day'});
 expect(await tutorial.finish('alice',s.sessionId,true)).toBe(true);
});
it('respects an explicit request to retain night when using daylight colors',async()=>{
 const s=begin('Change the sky to daylight blue but keep the night and moon');
 tutorial.tools('alice',s.sessionId).updateTheme({background:{type:'solid',colors:['#8fd3ff']}});
 expect(await tutorial.finish('alice',s.sessionId,true)).toBe(true);
});

it('lets an unfinished Getting Started task be resumed after leaving it', () => {
 const s=tutorial.startTour('alice');
 tutorial.tourAction('alice','skip-tour');
 expect(tutorial.startTour('alice')).toMatchObject({tour:'meet',sessionId:s.sessionId,version:s.version});
 expect(guide.mock.calls.at(-1)?.[1].text).not.toMatch(/pop up/);
});

it('rejects crude replacement art before writing and before publishing direct edits', async () => {
 const s=begin('make the runner a pig');const work=tutorial.workspace('alice',s.sessionId)!;
 const file=path.join(work,'theme.json'), before=fs.readFileSync(file,'utf8');
 const player={name:'Pig',scale:3,frames:[Array(10).fill('kkkkwwwwkkkk')],duck:Array(10).fill('kkkkwwwwkkkk')};
 expect(()=>tutorial.tools('alice',s.sessionId).updateTheme({player})).toThrow('artwork needs repair');
 expect(fs.readFileSync(file,'utf8')).toBe(before);
 fs.writeFileSync(file,JSON.stringify({...JSON.parse(before),player}));
 await expect(tutorial.check('alice',s.sessionId)).rejects.toThrow('artwork needs repair');
 expect(validate).not.toHaveBeenCalled();
 tutorial.tools('alice',s.sessionId).updateTheme({playerPreset:'pig'});
 expect(await tutorial.finish('alice',s.sessionId,true)).toBe(true);
 expect(tutorial.state('alice')?.canUndo).toBe(true);
});

it('blocks custom artwork on visual defects, repairs it, and publishes only the reviewed version',async()=>{
 tutorial.dispose();
 const captureArt=jest.fn(async()=>({contactSheet:'data:image/png;base64,AA==',scene:'data:image/png;base64,AA==',groundingCode:'123456'}));
 const reviewArt=jest.fn().mockResolvedValueOnce({pass:false,observations:['shape','shade','poses','scene'],defects:['The muzzle disconnects in frame 2.']}).mockResolvedValueOnce({pass:true,observations:['shape','shade','poses','scene'],defects:[]});
 tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate,captureArt,reviewArt});
 const s=begin('make an original silver pig');
 tutorial.tools('alice',s.sessionId).updateTheme({playerPreset:'pig',spritePalette:{'3':'#888888'}});
 await expect(tutorial.check('alice',s.sessionId)).rejects.toThrow('muzzle disconnects');
 expect(tutorial.state('alice')?.version).toBe(s.version);
 expect(tutorial.repair('alice',s.sessionId,'The muzzle disconnects in frame 2.',1)).toContain('muzzle disconnects');
 tutorial.tools('alice',s.sessionId).updateTheme({spritePalette:{'3':'#999999'}});
 expect(await tutorial.finish('alice',s.sessionId,true)).toBe(true);
 expect(reviewArt).toHaveBeenCalledTimes(2);
 expect(captureArt).toHaveBeenCalledTimes(2);
});
it('keeps the original game when the custom character reviewer is unavailable',async()=>{
 const s=begin('make a silver pig');
 tutorial.tools('alice',s.sessionId).updateTheme({playerPreset:'pig',spritePalette:{'3':'#888888'}});
 expect(await tutorial.finish('alice',s.sessionId,true)).toBe(false);
 expect(tutorial.state('alice')?.version).toBe(s.version);
 expect(tutorial.state('alice')?.error).toContain('visual check');
});

it('uses the specialist artist but does not publish its draft before the app check',async()=>{
 tutorial.dispose();
 const captureArt=jest.fn(async()=>({contactSheet:'data:image/png;base64,AA==',scene:'data:image/png;base64,AA==',groundingCode:'123456'}));
 const designArt=jest.fn(async(_session,_request,theme)=>({...theme,player:{...theme.player,name:'Drawn character'}}));
 const reviewArt=jest.fn(async()=>({pass:true,observations:['shape','shade','poses','scene'],defects:[]}));
 tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate,captureArt,reviewArt,designArt});
 const s=begin('draw an original character');
 await tutorial.tools('alice',s.sessionId).designCharacter('detailed artwork');
 expect(designArt).toHaveBeenCalledTimes(1);expect(tutorial.state('alice')?.version).toBe(s.version);
 expect(reviewArt).not.toHaveBeenCalled();expect(await tutorial.finish('alice',s.sessionId,true)).toBe(true);expect(reviewArt).toHaveBeenCalledTimes(1);
});
it('does not save a specialist design that returns after the user stops',async()=>{
 tutorial.dispose();let resolve!: (theme:any)=>void;
 const captureArt=jest.fn(async()=>({contactSheet:'data:image/png;base64,AA==',scene:'data:image/png;base64,AA==',groundingCode:'123456'}));
 let draft:any;
 const designArt=jest.fn(async(_session,_request,theme)=>{draft=theme;return new Promise<any>(r=>{resolve=r})});
 tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate,captureArt,designArt});
 const s=begin('draw a robot');const pending=tutorial.tools('alice',s.sessionId).designCharacter('robot');
 await Promise.resolve();await Promise.resolve();await tutorial.finish('alice',s.sessionId,false,'stopped');resolve(draft);
 await expect(pending).rejects.toThrow('stopped');expect(tutorial.state('alice')?.version).toBe(s.version);
});

it('builds the cached starter in the selected folder and reports real file activity', async () => {
 const selected=path.join(root,'selected');fs.mkdirSync(selected);
 fs.writeFileSync(path.join(selected,'notes.txt'),'keep me');
 const s=tutorial.startTour('alice');
 expect(tutorial.state('alice')?.workspaceDirectory).toBeUndefined();
 tutorial.requestStarterBuild('alice');
 const built=await tutorial.buildStarterInFolder('alice',selected);
 expect(built.starterBuild).toBe('ready');expect(built.tour).toBe('active');
 expect(path.dirname(built.workspaceDirectory!)).toBe(fs.realpathSync(selected));
 expect(fs.readFileSync(path.join(selected,'notes.txt'),'utf8')).toBe('keep me');
 expect(fs.readFileSync(path.join(built.workspaceDirectory!,'coco-game.html'),'utf8')).toContain('<html');
 expect(built.buildActivity?.filter(a=>a.kind==='tool'&&a.call.status==='completed')).toHaveLength(8);
 expect(validate).toHaveBeenCalled();
 // Later restores must preserve unrelated files in the user's game folder.
 fs.writeFileSync(path.join(built.workspaceDirectory!,'my-notes.txt'),'keep too');
 tutorial.writing('alice');tutorial.begin('alice',s.sessionId,jest.fn(),'make it daylight');
 expect(fs.readFileSync(path.join(built.workspaceDirectory!,'my-notes.txt'),'utf8')).toBe('keep too');
 tutorial.tools('alice',s.sessionId).updateTheme({timeOfDay:'day'});
 await tutorial.check('alice',s.sessionId);await tutorial.finish('alice',s.sessionId,true);
 expect(fs.readFileSync(path.join(built.workspaceDirectory!,'coco-game.html'),'utf8')).toContain('"timeOfDay":"day"');
});
it('keeps a failed starter hidden and allows selecting another folder to retry', async () => {
 const selected=path.join(root,'selected');fs.mkdirSync(selected);
 tutorial.startTour('alice');tutorial.requestStarterBuild('alice');
 validate.mockRejectedValueOnce(Error('Preview failed'));
 await expect(tutorial.buildStarterInFolder('alice',selected)).rejects.toThrow('Preview failed');
 expect(tutorial.state('alice')).toMatchObject({starterBuild:'error',tour:'meet'});
 const built=await tutorial.buildStarterInFolder('alice',selected);
 expect(built.starterBuild).toBe('ready');
});
it('restores a chosen workspace on reopen and keeps the saved activity', async () => {
 const selected=path.join(root,'selected');fs.mkdirSync(selected);
 tutorial.startTour('alice');tutorial.requestStarterBuild('alice');
 const built=await tutorial.buildStarterInFolder('alice',selected);
 tutorial.dispose();tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate});
 expect(tutorial.state('alice')).toMatchObject({starterBuild:'ready',workspaceDirectory:built.workspaceDirectory});
 expect(tutorial.workspace('alice',built.sessionId)).toBe(built.workspaceDirectory);
 expect(tutorial.state('alice')?.buildActivity).toHaveLength(8);
});
it('recovers an interrupted cached build without showing an unfinished game', () => {
 tutorial.startTour('alice');tutorial.requestStarterBuild('alice');tutorial.dispose();
 const file=path.join(root,'runner-tutorial','alice','state.json');
 const saved=JSON.parse(fs.readFileSync(file,'utf8'));
 saved.starterBuild='building';saved.buildActivity=[{kind:'tool',call:{id:'write',name:'write',arguments:{path:'theme.json'},status:'running'}}];
 fs.writeFileSync(file,JSON.stringify(saved));
 tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate});
 expect(tutorial.state('alice')).toMatchObject({starterBuild:'error',tour:'meet'});
 expect(tutorial.state('alice')?.buildActivity?.[0]).toMatchObject({call:{status:'error'}});
});

it('allows onboarding questions before a game workspace is chosen', () => {
 const state=tutorial.startTour('alice');
 const unrelatedFolder=path.join(root,'default-workspace');
 expect(tutorial.begin('alice',state.sessionId,jest.fn(),'who are you',unrelatedFolder)).toBeNull();
 expect(tutorial.state('alice')).toMatchObject({tour:'meet',phase:'play',error:null});
 tutorial.requestStarterBuild('alice');
 expect(tutorial.begin('alice',state.sessionId,jest.fn(),'What does Workspace do?',unrelatedFolder)).toBeNull();
 expect(tutorial.state('alice')).toMatchObject({starterBuild:'waiting',phase:'play'});
});
it('still requires the game workspace for game edits after onboarding setup', () => {
 const state=tutorial.startTour('alice');tutorial.tourAction('alice','tour-play');
 expect(()=>tutorial.begin('alice',state.sessionId,jest.fn(),'Make it daylight',path.join(root,'wrong-folder'))).toThrow('Choose your game folder');
 expect(tutorial.state('alice')?.phase).toBe('play');
 expect(tutorial.begin('alice',state.sessionId,jest.fn(),'Make it daylight',tutorial.workspace('alice',state.sessionId)!)).toEqual(expect.any(String));
});

it('paces the cached build before executing each real tool operation', async () => {
  tutorial.dispose();
  const pauses: number[] = [];
  tutorial=new RunnerTutorial({dataDir:root,node:process.execPath,guide,changed,validate,
    starterPause:async milliseconds => {
      pauses.push(milliseconds);
      const activity=tutorial.state('alice')?.buildActivity ?? [];
      if(activity.length) expect(activity[activity.length-1]).toMatchObject({kind:'tool',call:{status:'running'}});
      else expect(tutorial.state('alice')?.starterBuild).toBe('building');
    },
  });
  const selected=path.join(root,'paced');fs.mkdirSync(selected);
  tutorial.startTour('alice');tutorial.requestStarterBuild('alice');
  await tutorial.buildStarterInFolder('alice',selected);
  expect(pauses).toEqual([6500,1800,1800,1800,1800,1800,1800,1800,2600]);
  expect(tutorial.state('alice')?.starterBuild).toBe('ready');
});

it.each(['folder-first','request-first'])('starts once when both onboarding prerequisites exist: %s', async order => {
 const selected=path.join(root,'selected');fs.mkdirSync(selected);
 tutorial.startTour('alice');
 if(order==='folder-first') tutorial.selectStarterFolder('alice',selected);
 else tutorial.requestStarterBuild('alice');
 await tutorial.buildRequestedStarter('alice');
 expect(fs.readdirSync(selected)).toEqual([]);
 if(order==='folder-first') tutorial.requestStarterBuild('alice');
 else tutorial.selectStarterFolder('alice',selected);
 const [built]=await Promise.all([tutorial.buildRequestedStarter('alice'),tutorial.buildRequestedStarter('alice')]);
 expect(built?.starterBuild).toBe('ready');
 expect(fs.readdirSync(selected)).toHaveLength(1);
 tutorial.requestStarterBuild('alice');await tutorial.buildRequestedStarter('alice');
 expect(fs.readdirSync(selected)).toHaveLength(1);
});
it('remembers an early workspace choice across a restart', async () => {
 const selected=path.join(root,'selected');fs.mkdirSync(selected);
 tutorial.startTour('alice');tutorial.selectStarterFolder('alice',selected);
 tutorial.dispose();tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate});
 expect(tutorial.state('alice')?.selectedStarterDirectory).toBe(fs.realpathSync(selected));
 tutorial.requestStarterBuild('alice');
 expect((await tutorial.buildRequestedStarter('alice'))?.starterBuild).toBe('ready');
});

it('offers the Discernment tip only after a reveal request and persists its one-time delivery', async () => {
 tutorial.startTour('alice');
 guide.mockClear();
 tutorial.suggestGameReview('alice');
 expect(guide).not.toHaveBeenCalled();
 const selected=path.join(root,'suggestion-project');fs.mkdirSync(selected);
 tutorial.requestStarterBuild('alice');
 await tutorial.buildStarterInFolder('alice',selected);
 expect(guide).not.toHaveBeenCalled();
 tutorial.suggestGameReview('alice');
 expect(guide).toHaveBeenCalledTimes(1);
 expect(guide.mock.calls[0][1].framework.fourDDimension).toBe('discernment');
 tutorial.suggestGameReview('alice');
 expect(guide).toHaveBeenCalledTimes(1);
 tutorial.dispose();
 tutorial=new RunnerTutorial({starterPause:async()=>{},dataDir:root,node:process.execPath,guide,changed,validate});
 tutorial.suggestGameReview('alice');
 expect(guide).toHaveBeenCalledTimes(1);
});

it('introduces the understanding check in a one-time Diligence bubble', () => {
 tutorial.startTour('alice');
 guide.mockClear();
 tutorial.suggestIdeaCheck('alice');
 expect(guide).not.toHaveBeenCalled();
 tutorial.writing('alice');
 guide.mockClear();
 tutorial.suggestIdeaCheck('alice');
 expect(guide).toHaveBeenCalledTimes(1);
 expect(guide.mock.calls[0][1].framework).toMatchObject({
   fourDDimension: 'diligence', title: 'Stay in the loop',
   body: expect.stringContaining('quiz yourself'),
 });
 tutorial.suggestIdeaCheck('alice');
 expect(guide).toHaveBeenCalledTimes(1);
});
