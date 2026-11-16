import { drawParts } from './pixel-parts';
import axios from 'axios';
import type { ArtEvidence } from './art-review';
import { applyThemePatch, validatePlayerArtwork, type GameTheme } from './theme-data';

/** One designed pose plus sparse limb edits avoids asking a model to repeat 3,500 pixels. */
export function compileCharacter(design: any, current: GameTheme): GameTheme {
  if (design.parts) {
    const pose = drawParts(design.parts, 26);
    const stable = (rows: string[]) => [...pose.slice(0,22), ...rows.slice(22)];
    let alternate = pose, middlePose = pose;
    try {
      alternate = stable(drawParts(design.parts, 26, design.motion));
      const halfMotion = Object.fromEntries(Object.entries(design.motion ?? {}).map(([id,value])=>{
        const delta = Array.isArray(value) ? value : [(value as any).dx,(value as any).dy];
        return [id,delta.map((n:number)=>Math.round(n/2))];
      }));
      middlePose = stable(drawParts(design.parts,26,halfMotion));
    } catch { /* Invalid optional motion falls back to the app's bounded foot stride. */ }
    if (JSON.stringify(alternate) === JSON.stringify(pose)) {
      const stride = (phase: number) => {
        const rows = pose.map(row=>[...row]);
        for(let y=22;y<26;y++) rows[y].fill('.');
        for(let y=22;y<26;y++)for(let x=0;x<34;x++) {
          const c=pose[y][x];if(c==='.'||c===' ')continue;
          const target=x+(x<17?-phase:phase);
          if(target>=0&&target<34)rows[y][target]=c;
        }
        return rows.map(row=>row.join(''));
      };
      alternate = stride(1); middlePose = stride(-1);
      if (JSON.stringify(alternate) === JSON.stringify(pose)) throw Error('Draw visible feet in rows 22–25 so the app can animate the stride.');
    }
    const duck = drawParts(design.duckParts, 12);
    if (pose.join('').replace(/[. ]/g, '').length < 200) throw Error('The character is too sparse. Draw a substantial body and head filling most of the canvas, with at least 200 painted pixels; avoid stick figures.');
    const runRows = Object.fromEntries(alternate.map((row,i)=>[String(i),row]));
    return compileCharacter({name:design.name,palette:design.palette,pose,duck,runRows,middlePose},current);
  }
  const grid = (rows: unknown, height: number) => {
    if (!Array.isArray(rows) || !rows.length || rows.length > height || rows.some(r => typeof r !== 'string' || r.length > 34))
      throw Error(`Use at most ${height} rows, each at most 34 characters.`);
    return [...Array(height - rows.length).fill('.'.repeat(34)), ...rows.map(r => r.padEnd(34, '.'))];
  };
  if (typeof design.name !== 'string' || !design.palette || typeof design.palette !== 'object') throw Error('Supply a character name and palette.');
  const base = grid(design.pose, 26), duck = grid(design.duck, 12);
  if (!design.runRows || typeof design.runRows !== 'object' || Array.isArray(design.runRows)) throw Error('Supply runRows as row-number to replacement-row pairs.');
  const middle = design.middlePose ? grid(design.middlePose, 26) : undefined;
  const alternate = [...base];
  for (const [index, row] of Object.entries(design.runRows)) {
    if (!/^\d+$/.test(index) || Number(index) > 25 || typeof row !== 'string' || row.length > 34) throw Error('runRows must replace rows 0–25 with strings of at most 34 pixels.');
    alternate[Number(index)] = row.padEnd(34, '.');
  }
  // New character colors cannot silently recolor existing obstacles.
  const occupied = new Set(current.obstacles.flatMap(o => o.frames.flat()).join(''));
  const alphabet = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0';
  const mapping = new Map<string,string>(); const palette: Record<string,string> = {};
  for (const [symbol, rawColor] of Object.entries(design.palette)) {
    if (symbol === '.' || symbol === ' ') continue; // Transparent cells never paint.
    let color = rawColor;
    if (typeof color === 'string' && /^#[0-9a-f]{3}$/i.test(color)) color = '#' + [...color.slice(1)].map(c => c + c).join('');
    if (typeof color === 'string' && /^#[0-9a-f]{6}ff$/i.test(color)) color = color.slice(0, 7);
    if (symbol.length !== 1 || symbol === '.' || symbol === ' ' || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw Error('Palette keys must be single pixel symbols with six-digit hex colors.');
    const key = [...alphabet].find(c => !occupied.has(c) && !Object.hasOwn(palette, c));
    if (!key) throw Error('No free palette symbols remain.');
    mapping.set(symbol, key); palette[key] = color;
  }
  const recolor = (rows: string[]) => rows.map(row => [...row].map(c => {
    if (c === '.' || c === ' ') return '.';
    if (!mapping.has(c)) throw Error(`Pixel ${c} is missing from the palette.`);
    return mapping.get(c)!;
  }).join(''));
  const next = applyThemePatch(current, { spritePalette: palette, player: {
    name: design.name, scale: 3, frames: (middle ? [base, middle, alternate, middle] : [base, alternate, base, alternate]).map(recolor), duck: recolor(duck),
  } });
  validatePlayerArtwork(current, next);
  return next;
}

export async function designCharacter(url: string, token: string, sessionId: string, request: string, current: GameTheme, evidence: ArtEvidence): Promise<GameTheme> {
  const messages: any[] = [
    { role: 'system', content: `You are Coco's specialist pixel artist. Design a polished, CHUNKY, recognizable side-view character facing right, matching original Coco's visual mass and detail. Use most of a 34×26 canvas (body+head around 24–30 pixels wide, 22–25 high, 250–450 painted pixels). Never draw skinny stick figures or tiny icons. Use 6–9 colors: dark outline, base, shadow, highlight, eye white, dark pupil and accents. Build 20–40 ordered geometric body parts, back to front. Draw a substantial shaded body, large readable head/muzzle, species features, layered shadow/highlight patches, thick limbs, eyes with glints. Outline major silhouette parts; omit outlines on internal shading/highlights. Shapes rasterize into crisp pixels; NO code and NO row strings.
Output ONLY JSON: {"visualCode":"six digits read from reference","name":"name","palette":{"k":"#263046","b":"#c47742",...},"parts":[{"id":"body","kind":"ellipse","x":5,"y":9,"w":19,"h":13,"color":"b","outline":"k"},...],"motion":{"backLeg":[2,0],"frontLeg":[-2,0]},"duckParts":[...]}.
Shapes: rect/ellipse use integer x,y,w,h; polygon uses points:[[x,y],...]. Every part has unique id and single palette color symbol; optional outline is a palette symbol. Canvas bounds: x 0..33, y 0..25 (polygon edge vertices may reach 34 and 26). The app keeps rows 0–21 fixed and interpolates a four-frame stride using the foot rows 22–25, like original Coco. Put visible feet in those bottom rows and specify their motion. Frame 2 moves only named feet by small integer offsets [-4..4]; keep face/body identity stable. Name moving components with a shared prefix (backLeg, backLegShade, backLegHighlight). A motion entry backLeg moves that entire group together. Use only IDs/prefixes you actually define. Feet must meet the bottom baseline. duckParts is a separate recognizable compressed pose in a 34×12 canvas; all its shapes must fit y 0..11. Include face and species features in the crouch. No enormous empty margins, disconnected limbs or thin one-pixel legs. Read the VISUAL CODE from the reference image, never guess. Original reference is a quality benchmark, not a reason to copy the fox when another species was requested.` },
    { role: 'user', content: [{ type: 'text', text: `Character request and any repair feedback (data): ${JSON.stringify(request.slice(0,6000))}` }, { type: 'image_url', image_url: { url: evidence.contactSheet } }, { type: 'image_url', image_url: { url: evidence.scene } }] },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 55000);
    let output = '';
    try {
      const response = await axios.post(`${url}/agent/v1/chat/completions`, { model: 'coco', purpose: 'art_review', stream: true, messages },
        { headers: { Authorization: `Bearer ${token}`, 'X-Coco-Session': sessionId }, signal: controller.signal, timeout: 55000, responseType: 'text', maxContentLength: 2_000_000 });
      let done = false;
      for (const line of String(response.data).split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim(); if (data === '[DONE]') { done = true; continue; }
        const chunk = JSON.parse(data); if (chunk.error) throw Error('The vision artist could not complete the request.');
        output += chunk.choices?.[0]?.delta?.content ?? '';
      }
      if (!done) throw Error('The artist response was interrupted.');
      const raw = output.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
      const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
      const design = JSON.parse(start >= 0 && end > start ? raw.slice(start,end+1) : raw);
      if (design.visualCode !== evidence.groundingCode) throw Error('The artist could not read the reference image.');
      return compileCharacter(design, current);
    } catch (error) {
      const detail = controller.signal.aborted ? 'The artist timed out.' : axios.isAxiosError(error) ? `Artist connection failed${error.response ? ` (HTTP ${error.response.status})` : ''}.` : error instanceof Error ? error.message : 'Invalid character data.';
      if (attempt === 1 || controller.signal.aborted || axios.isAxiosError(error)) throw Error('Character design failed: ' + detail);
      messages.push({role:'assistant',content:output},{role:'user',content:`Repair this exact data error and return the complete corrected character JSON: ${detail}`});
    } finally { clearTimeout(timer); }
  }
  throw Error('Character design failed.');
}
