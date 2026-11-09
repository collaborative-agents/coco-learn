/** @jest-environment node */
import axios from 'axios';
import original from './theme.json';
import {applyThemePatch} from './theme-data';
import {needsArtReview,parseArtVerdict,reviewCharacterArt} from './art-review';
jest.mock('axios');
const verdict={visualCode:"123456",candidateDescription:"A drawn animal",pass:true,observations:['Readable silhouette','Coherent shading','Consistent run poses','Grounded at game scale'],defects:[]};
it('reviews original custom art and modified presets, but skips untouched art and exact authored presets',()=>{
 expect(needsArtReview(original,applyThemePatch(original,{timeOfDay:'day'}))).toBe(false);
 for(const playerPreset of ['cat','dog','rabbit','pig'])expect(needsArtReview(original,applyThemePatch(original,{playerPreset}))).toBe(false);
 const custom=applyThemePatch(original,{playerPreset:'pig',spritePalette:{'3':'#888888'}});
 expect(needsArtReview(original,custom)).toBe(true);
});
it('rejects empty, contradictory and vague review results',()=>{
 expect(parseArtVerdict(JSON.stringify(verdict))).toEqual(verdict);
 for(const v of [{...verdict,observations:[]},{...verdict,defects:['Broken feet']},{...verdict,pass:false},{pass:'yes'}])expect(()=>parseArtVerdict(JSON.stringify(v))).toThrow();
});
it('sends both rendered images to a separate no-tool review and parses streamed JSON',async()=>{
 (axios.post as jest.Mock).mockResolvedValue({data:`data: ${JSON.stringify({choices:[{delta:{content:JSON.stringify(verdict)}}]})}\n\ndata: [DONE]\n\n`});
 const evidence={contactSheet:'data:image/png;base64,AAA',scene:'data:image/png;base64,BBB',groundingCode:'123456'};
 expect(await reviewCharacterArt('http://local','secret','session','draw a turtle',evidence)).toEqual(verdict);
 const body=(axios.post as jest.Mock).mock.calls.at(-1)[1];
 expect(body.tools).toBeUndefined();expect(body.messages[1].content.slice(1).map((v:any)=>v.image_url.url)).toEqual([evidence.contactSheet,evidence.scene]);
});
it('fails closed on incomplete streams and provider errors',async()=>{
 for(const data of ['data: [DONE]\n','data: {"error":{"message":"failure"}}\n\ndata: [DONE]\n']){
 (axios.post as jest.Mock).mockResolvedValue({data});
 await expect(reviewCharacterArt('http://local','secret','session','cat',{contactSheet:'a',scene:'b',groundingCode:'123456'})).rejects.toThrow();
 }
});

it('rejects a fabricated visual assessment even if it claims success',async()=>{
 (axios.post as jest.Mock).mockResolvedValue({data:`data: ${JSON.stringify({choices:[{delta:{content:JSON.stringify({...verdict,visualCode:'000000'})}}]})}\n\ndata: [DONE]\n`});
 await expect(reviewCharacterArt('http://local','secret','session','turtle',{contactSheet:'a',scene:'b',groundingCode:'123456'})).rejects.toThrow('could not reliably read');
});
it('accepts a complete valid JSON assessment after a prose preface',()=>{
 expect(parseArtVerdict('I inspected the images.\n'+JSON.stringify(verdict))).toEqual(verdict);
});
it('retries malformed review output on the same images instead of requesting a new drawing',async()=>{
 (axios.post as jest.Mock).mockReset().mockResolvedValueOnce({data:'data: {"choices":[{"delta":{"content":"I need to inspect this"}}]}\n\ndata: [DONE]\n'}).mockResolvedValueOnce({data:`data: ${JSON.stringify({choices:[{delta:{content:JSON.stringify(verdict)}}]})}\n\ndata: [DONE]\n`});
 const evidence={contactSheet:'a',scene:'b',groundingCode:'123456'};
 expect(await reviewCharacterArt('http://local','secret','session','owl',evidence)).toEqual(verdict);
 expect(axios.post).toHaveBeenCalledTimes(2);
 const calls=(axios.post as jest.Mock).mock.calls;expect(calls[0][1].messages).toEqual(calls[1][1].messages);
});
