export interface PixelPart {
  id: string; kind: 'ellipse' | 'rect' | 'polygon'; color: string; outline?: string;
  x?: number; y?: number; w?: number; h?: number; points?: number[][];
}
/** Rasterize bounded data only: no model-authored JS, SVG execution or dependencies. */
export function drawParts(parts: PixelPart[], height: number, motion: Record<string, number[]> = {}) {
  if (!Array.isArray(parts) || !parts.length || parts.length > 100) throw Error('Use 1–100 ordered body parts.');
  if (!motion || typeof motion !== 'object' || Array.isArray(motion)) throw Error('Motion must map body-part names to [dx,dy] offsets.');
  const canonical = (id: string) => id.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/rear/g, 'back').replace(/[^a-z0-9]/g, '');
  const motionKeys = Object.keys(motion).sort((a,b)=>b.length-a.length);
  const matching = (id: string, key: string) => canonical(id).startsWith(canonical(key));
  const pixels = Array.from({length:height},()=>Array(34).fill('.'));
  const ids=new Set<string>();
  for(const p of parts){
    if(!p || typeof p.id!=='string' || ids.has(p.id) || !['ellipse','rect','polygon'].includes(p.kind) || typeof p.color!=='string' || p.color.length!==1 || (p.outline!==undefined && (typeof p.outline!=='string'||p.outline.length!==1))) throw Error('Each body part needs a unique id, valid shape and single palette symbols.');
    ids.add(p.id);
    const key=motionKeys.find(k=>matching(p.id,k));
    const raw=key?motion[key]:[0,0];
    const delta=raw && !Array.isArray(raw) && typeof raw==='object' ? [(raw as any).dx,(raw as any).dy] : raw;
    if(!Array.isArray(delta)||delta.length!==2||delta.some(v=>!Number.isInteger(v)||Math.abs(v)>4))throw Error(`Motion for ${p.id} must be [dx,dy], integers between -4 and 4; received ${JSON.stringify(delta)}.`);
    const [dx,dy]=delta;
    let inside:(x:number,y:number)=>boolean;
    if(p.kind==='polygon'){
      if(!Array.isArray(p.points)||p.points.length<3||p.points.length>30||p.points.some(v=>!Array.isArray(v)||v.length!==2||v.some(n=>!Number.isInteger(n))||v[0]<0||v[0]>34||v[1]<0||v[1]>height))throw Error('Polygon vertices must stay within the 34-column canvas.');
      inside=(x,y)=>{let hit=false;for(let i=0,j=p.points!.length-1;i<p.points!.length;j=i++){
        const [a,b]=p.points![i], [c,d]=p.points![j];
        if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
      }return hit};
    }else{
      if([p.x,p.y,p.w,p.h].some(v=>!Number.isInteger(v))||p.w!<=0||p.h!<=0||p.x!<0||p.y!<0||p.x!+p.w!>34||p.y!+p.h!>height)throw Error(`Shape rectangles must fit within 34×${height}.`);
      inside=p.kind==='rect'?(x,y)=>x>=p.x!&&x<p.x!+p.w!&&y>=p.y!&&y<p.y!+p.h!:(x,y)=>((x-p.x!-p.w!/2)/(p.w!/2))**2+((y-p.y!-p.h!/2)/(p.h!/2))**2<=1;
    }
    const cells:number[][]=[];
    for(let y=0;y<height;y++)for(let x=0;x<34;x++)if(inside(x+.5-dx,y+.5-dy))cells.push([x,y]);
    if(p.outline)for(const [x,y]of cells)for(const [a,b]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(a>=0&&a<34&&b>=0&&b<height)pixels[b][a]=p.outline;
    for(const [x,y]of cells)pixels[y][x]=p.color;
  }
  for(const id of motionKeys)if(![...ids].some(part=>matching(part,id)))throw Error(`Unknown moving part ${id}. Use these part IDs or a shared prefix: ${[...ids].join(', ')}.`);
  return pixels.map(row=>row.join(''));
}
