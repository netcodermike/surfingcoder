export const $=id=>document.getElementById(id);
export function field(label,id,type='text',value='',extra=''){return `<label for="${id}">${label}</label><input id="${id}" type="${type}" value="${value}" ${extra}>`}
export function select(label,id,options){return `<label for="${id}">${label}</label><select id="${id}">${options.map(x=>`<option value="${Array.isArray(x)?x[0]:x}">${Array.isArray(x)?x[1]:x}</option>`).join('')}</select>`}
export function area(label,id,value){return `<label for="${id}">${label}</label><textarea id="${id}">${value}</textarea>`}
export function button(label,id){return `<button id="${id}">${label}</button>`}
export function on(id,fn){$(id).onclick=async()=>{try{$('status').textContent='';await fn()}catch(e){$('status').textContent=e.message||String(e)}}}
export function show(value){$('output').textContent=typeof value==='string'?value:JSON.stringify(value,null,2)}
export function download(name,value,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
let ac;export async function audio(){ac??=new AudioContext();if(ac.state==='suspended')await ac.resume();return ac}
export async function tone(hz,when=0,duration=.5,shape='sine',gain=.12){const c=await audio(),o=c.createOscillator(),g=c.createGain(),t=c.currentTime+when;o.type=shape;o.frequency.value=hz;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(c.destination);o.start(t);o.stop(t+duration+.02)}
export function plot(values,color='#a5e4cc'){const c=$('canvas'),ctx=c.getContext('2d');ctx.fillStyle='#0d1a24';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#283e4e';for(let y=40;y<c.height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(c.width,y);ctx.stroke()}if(!values.length)return;const max=Math.max(1,...values.map(Math.abs));ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();values.forEach((v,i)=>{const x=i/(values.length-1||1)*c.width,y=c.height/2-v/max*c.height*.42;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}
export const notes=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];export const hz=m=>440*2**((m-69)/12);export const note=m=>notes[((Math.round(m)%12)+12)%12]+(Math.floor(Math.round(m)/12)-1);
export async function microphone(){if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone needs HTTPS or localhost and browser permission.');return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}})}
window.addEventListener('pagehide',()=>ac?.close());
