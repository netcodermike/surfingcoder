import{fresh,validate,append,visible}from'./model.js';

const el=(id       )=>document.getElementById(id) ;const canvas=el('board')                    ,ctx=canvas.getContext('2d') ;
let board      =fresh(),layer=0,draft            =null,undo        =[],redo        =[];
const status=(text       )=>el('status').textContent=text;
function stroke(s       ){ctx.strokeStyle=s.color;ctx.lineWidth=s.width;ctx.lineCap='round';ctx.lineJoin='round';const a=s.points[0],b=s.points.at(-1) ;ctx.beginPath();if(s.tool==='rect')ctx.rect(a.x,a.y,b.x-a.x,b.y-a.y);else if(s.tool==='line'){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}else{s.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(s.points.length===1)ctx.lineTo(a.x+.01,a.y);}ctx.stroke();}
function draw(){ctx.fillStyle='white';ctx.fillRect(0,0,1200,800);visible(board).forEach(stroke);if(draft&&board.layers[layer].visible)stroke(draft);const select=el('layers')                    ;select.replaceChildren(...board.layers.map((l,i)=>new Option((l.visible?'● ':'○ ')+l.name,String(i))));select.value=String(layer);}
function commit(next      ){const checked=validate(next);undo.push(structuredClone(board));if(undo.length>30)undo.shift();redo=[];board=checked;layer=Math.min(layer,board.layers.length-1);draft=null;draw();status('Project changed. Save to keep this version.');}
const point=(e             )=>{const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1200,(e.clientX-r.left)/r.width*1200)),y:Math.max(0,Math.min(800,(e.clientY-r.top)/r.height*800))};};
canvas.onpointerdown=e=>{if(e.button!==0)return;if(!board.layers[layer].visible){status('Show the selected layer before drawing.');return;}canvas.setPointerCapture(e.pointerId);draft={tool:(el('tool')                    ).value                  ,color:(el('color')                   ).value,width:Number((el('width')                   ).value),points:[point(e)]};};
canvas.onpointermove=e=>{if(draft){if(draft.points.length<10000)draft.points.push(point(e));draw();}};
canvas.onpointerup=()=>{if(draft){try{commit(append(board,layer,draft));}catch(e){draft=null;status((e         ).message);draw();}}};canvas.onpointercancel=()=>{draft=null;draw();};
el('layers').onchange=()=>{draft=null;layer=Number((el('layers')                    ).value);draw();};
el('undo').onclick=()=>{if(undo.length){redo.push(board);board=undo.pop() ;layer=Math.min(layer,board.layers.length-1);draft=null;draw();}};
el('redo').onclick=()=>{if(redo.length){undo.push(board);board=redo.pop() ;layer=Math.min(layer,board.layers.length-1);draw();}};
el('add').onclick=()=>{if(board.layers.length===12){status('Layer limit reached.');return;}const next=structuredClone(board);next.layers.push({name:'Layer '+(next.layers.length+1),visible:true,strokes:[]});commit(next);layer=board.layers.length-1;draw();};
el('toggle').onclick=()=>{const next=structuredClone(board);next.layers[layer].visible=!next.layers[layer].visible;commit(next);};
el('remove').onclick=()=>{if(board.layers.length===1){status('Keep at least one layer. Use Clear layer instead.');return;}const next=structuredClone(board);next.layers.splice(layer,1);commit(next);};
el('clear').onclick=()=>{const next=structuredClone(board);next.layers[layer].strokes=[];commit(next);};
function download(name       ,data     ){const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
el('save').onclick=()=>{try{localStorage.setItem('whiteboard-v1',JSON.stringify(board));status('Saved in this browser.');}catch(e){status((e         ).message);}};
el('load').onclick=()=>{try{commit(validate(JSON.parse(localStorage.getItem('whiteboard-v1')??'null')));status('Browser save loaded.');}catch(e){status((e         ).message);}};
el('export').onclick=()=>download('whiteboard.json',new Blob([JSON.stringify(board,null,2)],{type:'application/json'}));
el('import').onchange=async()=>{try{const file=(el('import')                   ).files?.[0];if(!file)return;if(file.size>10*1024*1024)throw Error('Project exceeds 10 MiB');commit(validate(JSON.parse(await file.text())));}catch(e){status((e         ).message);}};
el('png').onclick=()=>{draft=null;draw();canvas.toBlob(blob=>{if(blob)download('whiteboard.png',blob);});};draw();
