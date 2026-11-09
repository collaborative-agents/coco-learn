import { BrowserWindow } from 'electron';
/** Real Chromium canvas/JS, isolated from Electron main and all user windows. */
export default async function validateGameInBrowser(html: string) {
  const win = new BrowserWindow({
    show: false,
    width: 1000,
    height: 600,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      offscreen: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  let timer: ReturnType<typeof setTimeout>;
  try {
    await Promise.race([
      (async () => {
        const instrumented = html.replace(
          '<script type="module">',
          '<script>globalThis.__gameErrors=[];addEventListener("error",e=>__gameErrors.push(e.message));addEventListener("unhandledrejection",e=>__gameErrors.push(String(e.reason)));</script><script type="module">',
        );
        await win.loadURL(
          'data:text/html;charset=utf-8,' + encodeURIComponent(instrumented),
        );
        await new Promise((resolve) => setTimeout(resolve, 40));
        // Electron replaces thrown renderer errors with a generic rejection.
        // Return the actual diagnostic across the boundary for automatic repair.
        const result = await win.webContents.executeJavaScript(`(()=>{try{
          if(globalThis.__gameErrors?.length)throw Error(__gameErrors.join('; '));
          const game=globalThis.__cocoGame;if(!game)throw Error('The game did not start. Check behavior.js syntax.');
          game.reset();game.state().spawn=Infinity;game.jump();game.step(1/60);
          if(!(game.state().y>0))throw Error('Jump did not respond. Check the behavior hooks.');
          for(let i=0;i<400;i++)game.step(1/60);
          if(!Number.isFinite(game.state().y)||game.state().y<0)throw Error('The behavior hook produced an invalid player position.');
          const flyingObstacle=globalThis.__cocoTheme.obstacles.find(o=>o.flying);
          if(globalThis.__cocoTheme.controls?.mode!=='fly'&&flyingObstacle){
            game.reset();game.state().spawn=Infinity;
            game.state().obstacles.push({x:135,sprite:flyingObstacle,width:flyingObstacle.frames[0][0].length*flyingObstacle.scale,height:flyingObstacle.frames[0].length*flyingObstacle.scale});
            dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
            game.step(1/60);
            dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowDown',bubbles:true}));
            if(game.state().over)throw Error('The crouching sprite is too tall to duck under a flying obstacle. Redraw player.duck at the original 34 columns by 12 rows with player.scale 3; do not reuse a standing pose.');
          }
          if(globalThis.__cocoTheme.controls?.mode==='fly'){
            game.reset();game.state().spawn=Infinity;
            dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));
            for(let i=0;i<45;i++)game.step(1/60);
            const high=game.state().y;
            dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}));
            for(let i=0;i<90;i++)game.step(1/60);
            if(high<40||!(game.state().y<high))throw Error('Flying controls did not rise while held and fall after release. Check behavior.js.');
          }
          game.reset();for(let i=0;i<1800;i++)game.step(1/60);
          if(!Number.isFinite(game.state().score)||game.state().distance<=0)throw Error('The game did not advance.');
          game.render();const c=document.querySelector('canvas'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          const colors=new Set();for(let i=0;i<data.length;i+=80)colors.add(data[i]+','+data[i+1]+','+data[i+2]);
          if(colors.size<3)throw Error('The game artwork did not render.');
          if(globalThis.__gameErrors?.length)throw Error(__gameErrors.join('; '));
          return {ok:true,colors:colors.size,score:game.state().score};
        }catch(error){return {ok:false,error:String(error?.message||error)};}})()`);
        if (!result.ok) throw Error(result.error);
      })(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Error(
                'Browser validation timed out. Check the behavior hooks for a loop.',
              ),
            ),
          8000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
    if (!win.isDestroyed()) win.destroy();
  }
}
