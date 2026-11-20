



export const fresh=()      =>({version:1,layers:[{name:'Layer 1',visible:true,strokes:[]}]});
export function validate(value        )      {
 const b=value         ;
 if(!b||b.version!==1||!Array.isArray(b.layers)||b.layers.length<1||b.layers.length>12)throw Error('Expected version 1 board with 1–12 layers');
 let count=0,points=0;
 for(const layer of b.layers){
  if(!layer||typeof layer.name!=='string'||layer.name.length>80||typeof layer.visible!=='boolean'||!Array.isArray(layer.strokes))throw Error('Invalid layer');
  for(const s of layer.strokes){
   if(++count>10000||!s||!['pen','line','rect'].includes(s.tool)||!/^#[0-9a-f]{6}$/i.test(s.color)||!Number.isFinite(s.width)||s.width<1||s.width>60||!Array.isArray(s.points)||!s.points.length)throw Error('Invalid stroke');
   points+=s.points.length;if(points>100000)throw Error('Too many points');
   if(s.points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1200||p.y<0||p.y>800))throw Error('Invalid point');
  }
 }return structuredClone(b);
}
export function append(board      ,index       ,stroke       )      {const next=structuredClone(board);if(!next.layers[index])throw Error('Missing layer');next.layers[index].strokes.push(stroke);return validate(next);}
export function visible(board      )         {return board.layers.filter(l=>l.visible).flatMap(l=>l.strokes);}
