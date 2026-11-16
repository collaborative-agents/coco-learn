/** @jest-environment node */
import original from './theme.json';
import {compileCharacter} from './character-artist';
import {validateTheme} from './theme-data';
const design=()=>({name:'Original test character',palette:original.spritePalette,pose:original.player.frames[0],runRows:Object.fromEntries(original.player.frames[1].map((row,i)=>[String(i),row])),duck:original.player.duck});
it('compiles one key pose and sparse row edits into consistent animation without recoloring obstacles',()=>{
 const next=compileCharacter(design(),original);validateTheme(next);
 expect(next.player.frames).toHaveLength(4);expect(next.player.frames[0]).not.toEqual(next.player.frames[1]);
 expect(next.player.frames.every(f=>f.length===26&&f.every(row=>row.length===34))).toBe(true);
 expect(next.player.duck).toHaveLength(12);
 const symbols=new Set(original.obstacles.flatMap(o=>o.frames.flat()).join(''));
 for(const c of symbols)if(c!=='.'&&c!==' ')expect(next.spritePalette[c as keyof typeof next.spritePalette]).toEqual(original.spritePalette[c as keyof typeof original.spritePalette]);
});
it('rejects oversized art, unknown colors and missing animation instead of inventing details',()=>{
 expect(()=>compileCharacter({...design(),pose:Array(27).fill('k')},original)).toThrow('at most 26');
 expect(()=>compileCharacter({...design(),runRows:{}},original)).toThrow('distinct running poses');
 expect(()=>compileCharacter({...design(),palette:{}},original)).toThrow('missing from the palette');
});
it('pads omitted transparent margins while anchoring feet at the same ground baseline',()=>{
 const input=design();input.pose=input.pose.slice(1).map(r=>r.replace(/\.+$/,''));
 const next=compileCharacter(input,original);expect(next.player.frames[0][0]).toBe('.'.repeat(34));
});
it('keeps the head and torso identical while interpolating a generated foot stride',()=>{
 const parts:any=[
  {id:'body',kind:'rect',x:8,y:10,w:17,h:12,color:'o',outline:'k'},
  {id:'head',kind:'rect',x:12,y:2,w:14,h:10,color:'b',outline:'k'},
  {id:'headShade',kind:'rect',x:12,y:3,w:3,h:8,color:'B'},
  {id:'shine',kind:'rect',x:16,y:3,w:8,h:2,color:'w'},
  {id:'eye',kind:'rect',x:23,y:7,w:2,h:2,color:'r'},
  {id:'footBack',kind:'rect',x:10,y:21,w:6,h:5,color:'s',outline:'k'},
  {id:'footFront',kind:'rect',x:21,y:21,w:6,h:5,color:'s',outline:'k'},
 ];
 const next=compileCharacter({name:'Test robot',palette:original.spritePalette,parts,motion:{head:[2,0],footBack:[4,0],footFront:[-4,0]},duckParts:[{id:'crouch',kind:'rect',x:5,y:1,w:24,h:10,color:'o',outline:'k'}]},original);
 for(const frame of next.player.frames)expect(frame.slice(0,22)).toEqual(next.player.frames[0].slice(0,22));
 expect(new Set(next.player.frames.map(f=>JSON.stringify(f))).size).toBe(3);
});
it('uses a bounded foot stride when the artist omits optional motion',()=>{
 const parts:any=[
  {id:'body',kind:'rect',x:8,y:10,w:17,h:12,color:'o',outline:'k'},
  {id:'head',kind:'rect',x:12,y:2,w:14,h:10,color:'b',outline:'k'},
  {id:'shade',kind:'rect',x:12,y:3,w:3,h:8,color:'B'},
  {id:'shine',kind:'rect',x:16,y:3,w:8,h:2,color:'w'},
  {id:'eye',kind:'rect',x:23,y:7,w:2,h:2,color:'r'},
  {id:'feet',kind:'rect',x:10,y:21,w:15,h:5,color:'s',outline:'k'},
 ];
 const next=compileCharacter({name:'Fallback stride',palette:original.spritePalette,parts,motion:{},duckParts:[{id:'crouch',kind:'rect',x:5,y:1,w:24,h:10,color:'o',outline:'k'}]},original);
 for(const frame of next.player.frames)expect(frame.slice(0,22)).toEqual(next.player.frames[0].slice(0,22));
 expect(new Set(next.player.frames.map(f=>JSON.stringify(f))).size).toBeGreaterThan(1);
});
