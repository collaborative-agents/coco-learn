import { randomInt } from 'crypto';
import { BrowserWindow } from 'electron';
import original from './theme.json';
import type { GameTheme } from './theme-data';
import type { ArtEvidence } from './art-review';

/** Render only game data in an isolated window, never the user's desktop. */
export async function captureCharacterArt(html: string, theme: GameTheme): Promise<ArtEvidence> {
  const win = new BrowserWindow({ show: false, width: 1000, height: 600,
    webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, offscreen: true, backgroundThrottling: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const groundingCode = String(randomInt(100000, 1000000));
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      (async () => {
        await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        return await win.webContents.executeJavaScript(`(() => {
          const original=${JSON.stringify(original)}, candidate=${JSON.stringify(theme)};
          const game=globalThis.__cocoGame;
          if(!game)throw Error('The game did not load for artwork review.');
          game.reset();game.state().spawn=Infinity;game.state().obstacles=[];game.render();
          const scene=document.querySelector('canvas').toDataURL('image/png');
          const sheet=document.createElement('canvas');sheet.width=Math.max(1000,(candidate.player.frames.length+1)*180+40);sheet.height=800;
          const ctx=sheet.getContext('2d');ctx.imageSmoothingEnabled=false;
          ctx.fillStyle='#e8eef8';ctx.fillRect(0,0,sheet.width,sheet.height);
          ctx.fillStyle='#152c48';ctx.font='bold 28px monospace';ctx.fillText('VISUAL CODE: '+${JSON.stringify(groundingCode)},650,40);
          const draw=(t,y,label)=>{
            ctx.fillStyle='#203f64';ctx.font='18px sans-serif';ctx.fillText(label,16,y+22);
            [...t.player.frames,t.player.duck].forEach((rows,index)=>{
              const x=22+index*180, bottom=y+200;
              ctx.strokeStyle='#b1bed2';ctx.beginPath();ctx.moveTo(x,bottom);ctx.lineTo(x+160,bottom);ctx.stroke();
              const scale=4;
              rows.forEach((row,j)=>[...row].forEach((c,i)=>{if(c==='.'||c===' ')return;ctx.fillStyle=t.spritePalette[c];ctx.fillRect(x+i*scale,bottom-(rows.length-j)*scale,scale,scale)}));
              ctx.fillStyle='#203f64';ctx.font='13px sans-serif';ctx.fillText(index===t.player.frames.length?'Crouch':'Run '+(index+1),x,bottom+20);
            });
          };
          draw(original,0,'Original Coco reference — same pixel scale');
          draw(candidate,260,'Candidate — every running frame and crouch');
          ctx.fillStyle='#203f64';ctx.font='18px sans-serif';ctx.fillText('Candidate at actual game scale',16,620);
          const rows=candidate.player.frames[0],scale=candidate.player.scale*2/3;
          rows.forEach((row,j)=>[...row].forEach((c,i)=>{if(c==='.'||c===' ')return;ctx.fillStyle=candidate.spritePalette[c];ctx.fillRect(24+i*scale,650+j*scale,scale,scale)}));
          const metrics=t=>{
            const first=t.player.frames[0];
            return t.player.frames.map((frame,index)=>{let changedPixels=0;const changedRows=[];
              frame.forEach((row,y)=>{let changed=false;[...row].forEach((c,x)=>{if(c!==first[y]?.[x]){changedPixels++;changed=true;}});if(changed)changedRows.push(y)});
              return {frame:index+1,changedPixelsComparedWithFrame1:changedPixels,changedRows,identicalTo:t.player.frames.map((f,i)=>JSON.stringify(f)===JSON.stringify(frame)?i+1:null).filter(Boolean)};
            });
          };
          return {scene,contactSheet:sheet.toDataURL('image/png'),animationFacts:JSON.stringify({reference:metrics(original),candidate:metrics(candidate)}),groundingCode:${JSON.stringify(groundingCode)}};
        })()`);
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('Artwork preview timed out.')), 8000); }),
    ]);
  } finally { clearTimeout(timer!); if (!win.isDestroyed()) win.destroy(); }
}
