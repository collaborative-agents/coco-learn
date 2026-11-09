/** @jest-environment node */
import {drawParts} from './pixel-parts';
it('rasterizes crisp filled geometry and moves only the specified body part',()=>{
 const parts:any=[{id:'body',kind:'rect',x:5,y:5,w:10,h:10,color:'b',outline:'k'},{id:'foot',kind:'rect',x:6,y:20,w:5,h:5,color:'s',outline:'k'}];
 const first=drawParts(parts,26),next=drawParts(parts,26,{foot:[2,0]});
 expect(first).toHaveLength(26);expect(first.every(r=>r.length===34)).toBe(true);
 expect(first[5][5]).toBe('b');expect(first[5][4]).toBe('k');
 expect(next.slice(0,19)).toEqual(first.slice(0,19));expect(next.slice(19)).not.toEqual(first.slice(19));
});
it('rejects arbitrary code, out-of-bounds geometry and unknown moving parts',()=>{
 expect(()=>drawParts([{id:'x',kind:'script'}] as any,26)).toThrow();
 expect(()=>drawParts([{id:'x',kind:'rect',x:30,y:0,w:20,h:5,color:'b'}],26)).toThrow('fit');
 expect(()=>drawParts([{id:'x',kind:'rect',x:0,y:0,w:5,h:5,color:'b'}],26,{missing:[1,0]})).toThrow('Unknown');
});
it('moves shaded limb groups together despite case and underscore differences',()=>{
 const parts:any=[{id:'back_leg',kind:'rect',x:5,y:15,w:8,h:10,color:'b'},{id:'back_leg_Shade',kind:'rect',x:5,y:15,w:3,h:10,color:'s'}];
 const moved=drawParts(parts,26,{backLeg:[2,0]});
 expect(moved[15].slice(7,10)).toBe('sss');expect(moved[15].slice(10,15)).toBe('bbbbb');
});
