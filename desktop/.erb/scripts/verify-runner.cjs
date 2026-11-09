const fs = require('fs');
const vm = require('vm');
const path = require('path');
if (!vm.SourceTextModule) {
  const r = require('child_process').spawnSync(
    process.execPath,
    ['--experimental-vm-modules', __filename],
    {
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      timeout: 12000,
    },
  );
  process.exit(r.status ?? 1);
}
(async () => {
  const names = [
    'config.js',
    'theme.js',
    'sprites.js',
    'behavior.js',
    'render.js',
    'mechanics.js',
  ];
  const sources = new Map(
    names.map((name) => {
      const file = path.join(process.cwd(), name),
        stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 160000)
        throw Error('Game file is missing or too large: ' + name);
      return [name, fs.readFileSync(file, 'utf8')];
    }),
  );
  const rectangles = [];
  const context = vm.createContext(
    { console: { log: () => {} } },
    { codeGeneration: { strings: false, wasm: false } },
  );
  const modules = new Map();
  function moduleFor(name) {
    if (!sources.has(name))
      throw Error('Only local game modules can be imported.');
    if (!modules.has(name))
      modules.set(
        name,
        new vm.SourceTextModule(sources.get(name), {
          context,
          identifier: name,
        }),
      );
    return modules.get(name);
  }
  const checks = `
    import {pixelConfig as config} from './config.js';
    import {createRun, advanceRun, jump} from './behavior.js';
    import {renderRun} from './render.js';
    import {foxRun,foxDuck,spritePalette} from './sprites.js';
    const assert=(v,m)=>{if(!v)throw Error(m)};
    assert(config.width===960 && config.height===420 && config.ground===342,'Keep the game canvas and ground dimensions stable.');
    for(const [key,min,max] of [['startSpeed',120,450],['maxSpeed',120,650],['acceleration',0,12],['gravity',700,2500],['jumpVelocity',400,950]])assert(Number.isFinite(config[key]) && config[key]>=min && config[key]<=max,'Check '+key);
    assert(config.maxSpeed>=config.startSpeed,'Maximum speed must exceed starting speed.');
    assert(Array.isArray(config.obstacleTypes)&&config.obstacleTypes.length && config.obstacleTypes.every(x=>['stump','mushroom','crystal','moth'].includes(x)),'Use the supported obstacle types.');
    assert(Object.values(config.theme).every(x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x)),'Use six-digit palette colors.');
    assert(foxRun.length>=2&&foxRun.length<=4,'Use 2–4 running frames.');
    assert(Object.keys(spritePalette).length<=24 && Object.values(spritePalette).every(x=>/^#[0-9a-f]{6}$/i.test(x)),'Use a small pixel-art palette.');
    const runHeight=foxRun[0].length;
    assert(runHeight>=16&&runHeight<=24&&foxRun.every(art=>art.length===runHeight),'Keep running frames at a consistent size.');
    assert(foxDuck.length>=8&&foxDuck.length<=14,'Keep the ducking pose low.');
    for(const art of [...foxRun,foxDuck]){
      for(const row of art)assert(row.length<=28&&[...row].every(x=>x===' '||spritePalette[x]),'Sprite contains an unknown pixel or is too wide.');
    }
    let s=createRun(config);s.spawnIn=Infinity;
    assert(jump(s,config),'Jump must respond.');advanceRun(s,config,1/60);
    assert(s.y>0&&!jump(s,config),'Do not allow double jumps.');
    for(let i=0;i<180;i++)advanceRun(s,config,1/60);
    assert(s.y===0,'The runner must land.');
    s=createRun(config);s.obstacles=[{x:150,kind:'moth'}];
    assert(advanceRun(s,config,1/60),'Standing should hit a low flying obstacle.');
    s=createRun(config);s.ducking=true;s.obstacles=[{x:150,kind:'moth'}];
    assert(!advanceRun(s,config,1/60),'Ducking should clear a flying obstacle.');
    s=createRun(config);s.obstacles=[{x:150,kind:'stump'}];
    assert(advanceRun(s,config,1/60)&&s.gameOver,'Collision must end the round.');
    const distance=s.distance;advanceRun(s,config,1/30);assert(s.distance===distance,'Stop movement after a hit.');
    s=createRun(config,428);s.spawnIn=Infinity;
    for(let i=0;i<420;i++)advanceRun(s,config,1/60);
    s.y=70;s.obstacles=[{x:320,kind:'mushroom'},{x:700,kind:'moth'}];
    const rects=[];let stack=[],tx=0,ty=0;
    const ctx={fillStyle:'#000000',globalAlpha:1,save(){stack.push([tx,ty])},restore(){[tx,ty]=stack.pop()||[0,0]},translate(x,y){tx+=x;ty+=y},fillRect(x,y,w,h){assert([x,y,w,h,tx,ty].every(Number.isFinite),'Invalid drawing dimensions');assert(rects.length<30000,'Drawing is too large');rects.push([x+tx,y+ty,w,h,this.fillStyle,this.globalAlpha])}};
    renderRun(ctx,s,config);
    assert(rects.length>150,'The game must render real pixel artwork.');
    globalThis.capture=rects;
  `;
  const root = new vm.SourceTextModule(checks, {
    context,
    identifier: 'checks',
  });
  await root.link((spec) => moduleFor(spec.replace(/^\.\//, '')));
  await root.evaluate({ timeout: 5000 });
  for (const [x, y, w, h, color, opacity] of context.capture) {
    if (typeof color !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(color))
      throw Error('Use pixel palette colors.');
    rectangles.push(
      `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" fill="${color}" opacity="${opacity}"/>`,
    );
  }
  fs.writeFileSync(
    'test-round.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" shape-rendering="crispEdges">${rectangles.join('')}</svg>`,
  );
  const previewFile = process.argv[2];
  if (previewFile) {
    const html = fs.readFileSync(previewFile, 'utf8');
    const script = html.match(/<script type="module">([\s\S]*)<\/script>/)?.[1];
    if (!script) throw Error('The playable preview is missing.');
    const browser = vm.createContext(
      {},
      { codeGeneration: { strings: false, wasm: false } },
    );
    vm.runInContext(
      `
      globalThis.drawn=0;globalThis.gameOvers=0;
      const ctx={fillRect(){drawn++},save(){},restore(){},translate(){}};
      const elements=new Map();
      globalThis.document={hidden:false,querySelector(selector){if(!elements.has(selector))elements.set(selector,{events:{},getContext(){return ctx},addEventListener(name,fn){this.events[name]=fn},focus(){}});return elements.get(selector)}};
      globalThis.localStorage={getItem(){return null},setItem(){}};
      globalThis.matchMedia=()=>({matches:false});
      globalThis.parent={postMessage(data){if(data.type==='runner-game-over')gameOvers++}};
      globalThis.addEventListener=()=>{};
      globalThis.requestAnimationFrame=callback=>{globalThis.tick=callback};
    `,
      browser,
      { timeout: 3000 },
    );
    vm.runInContext('"use strict";' + script, browser, { timeout: 3000 });
    vm.runInContext(
      'for(let i=0;i<900;i++)tick(i*17);if(drawn<1000||gameOvers<1)throw Error("The playable round did not work.");document.querySelector("canvas").events.pointerdown();for(let i=900;i<930;i++)tick(i*17);',
      browser,
      { timeout: 5000 },
    );
  }
  console.log(
    'PASS: sprites, configuration, jumping, ducking, collision, restart state, and rendered test round.',
  );
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
