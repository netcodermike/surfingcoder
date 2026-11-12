export const range = n => Array.from({length:n}, (_, i) => i);
export const sum = values => values.reduce((a,b) => a+b, 0);
export const fmt = value => Number.isFinite(value) ? Number(value.toPrecision(5)).toString() : '—';
export const colors = ['#54e5cf','#c5a3ff','#ffb672','#f480ad','#82b7ff','#e6df86','#a7e989','#ed9077'];
export function element(tag, label, parent, className) {
  const node = document.createElement(tag);
  if (label != null) node.textContent = label;
  if (className) node.className = className;
  parent?.append(node);
  return node;
}
export function table(parent, headers, rows) {
  const node = element('table', null, parent);
  const head = node.createTHead().insertRow();
  for (const header of headers) element('th', header, head).scope = 'col';
  const body = node.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    for (const cell of row) element('td', cell, tr);
  }
  return node;
}
export function surface(parent, label, height=360, width=760) {
  const canvas = element('canvas', null, parent);
  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',label);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111222';
  ctx.fillRect(0,0,width,height);
  return {canvas,ctx,width,height};
}
export function chart(parent, title, series, {xLabel='',yLabel='', height=290, yBounds, xBounds}={}) {
  element('h2', title, parent);
  const {canvas,ctx,width} = surface(parent,title,height);
  const points = series.flatMap(s=>s.points).filter(p=>p.every(Number.isFinite));
  if (!points.length) return canvas;
  const padded = (a,b) => a===b ? [a-1,b+1] : [a,b];
  const [xmin,xmax] = xBounds ?? padded(Math.min(...points.map(p=>p[0])),Math.max(...points.map(p=>p[0])));
  const [ymin,ymax] = yBounds ?? padded(Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[1])));
  const left=67, right=width-24, top=22, bottom=height-51;
  const x = v=>left+(v-xmin)/(xmax-xmin)*(right-left);
  const y = v=>bottom-(v-ymin)/(ymax-ymin)*(bottom-top);
  ctx.font='13px system-ui';
  for (let i=0;i<=5;i++) {
    const xx=left+(right-left)*i/5, yy=top+(bottom-top)*i/5;
    ctx.strokeStyle='#34344b';ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,bottom);ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke();
    ctx.fillStyle='#ccc9df';ctx.textAlign='right';ctx.fillText(fmt(ymax-(ymax-ymin)*i/5),left-8,yy+4);
    ctx.textAlign='center';ctx.fillText(fmt(xmin+(xmax-xmin)*i/5),xx,bottom+18);
  }
  ctx.fillText(xLabel,(left+right)/2,height-9);
  ctx.save();ctx.translate(14,(bottom+top)/2);ctx.rotate(-Math.PI/2);ctx.fillText(yLabel,0,0);ctx.restore();
  ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
  for (const [i,s] of series.entries()) {
    ctx.strokeStyle=s.color??colors[i%colors.length];ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=2.5;ctx.beginPath();
    let started=false;
    for (const [a,b] of s.points) {
      if (!Number.isFinite(a)||!Number.isFinite(b)) {started=false;continue;}
      if (s.dots) {ctx.fillRect(x(a)-2,y(b)-2,4,4);continue;}
      if (started) ctx.lineTo(x(a),y(b)); else ctx.moveTo(x(a),y(b));
      started=true;
    }
    ctx.stroke();
  }
  ctx.restore();
  const legend=element('div',null,parent,'legend');
  series.forEach((s,i)=>{const item=element('span',s.name,legend);item.style.setProperty('--swatch',s.color??colors[i%colors.length]);});
  return canvas;
}
export function board(parent, n) {
  const grid=element('div',null,parent,'board');
  grid.style.setProperty('--columns',n);
  return grid;
}
export function badge(parent,text) { return element('p',text,parent,'result'); }
export function download(name,data) {
  const link=document.createElement('a');
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function mount(app) {
  document.title=app.title;
  document.querySelector('h1').textContent=app.title;
  document.querySelector('#description').textContent=app.description;
  const form=document.querySelector('form');
  const main=document.querySelector('#visualization');
  const error=document.querySelector('#error');
  const inputs={};
  const values=()=>Object.fromEntries(app.controls.map(c=>[c.key,c.type==='number'||c.type==='range'? inputs[c.key].valueAsNumber:inputs[c.key].value]));
  const state={};
  let dispose;
  const render=()=>{
    dispose?.();dispose=undefined;error.textContent='';main.replaceChildren();
    try {
      const options=values();
      if (Object.values(options).some(v=>typeof v==='number'&&!Number.isFinite(v))) throw new Error('Enter a number in each numeric field.');
      dispose=app.render(main, options, state, render);
      document.body.dataset.ready='true';
    } catch (problem) {
      error.textContent=problem.message;
      if (!(problem instanceof RangeError) && !(problem instanceof SyntaxError)) console.error(problem);
    }
  };
  for(const c of app.controls) {
    const label=element('label',c.label,form);
    const input=element(c.type==='select'?'select':c.type==='textarea'?'textarea':'input',null,label);
    if(c.type==='select') {
      for(const option of c.options) {
        const [value,caption]=Array.isArray(option)?option:[option,option];
        element('option',caption,input).value=value;
      }
    } else if(c.type!=='textarea') {
      input.type=c.type??'text';
      for (const key of ['min','max','step']) if(c[key]!=null) input[key]=c[key];
    }
    input.name=c.key;
    input.value=c.value;
    inputs[c.key]=input;
    if(c.type==='range') {
      const output=element('output',input.value,label);
      input.addEventListener('input',()=>{output.value=input.value;render();});
    }
    if(c.live&&c.type!=='range') input.addEventListener('change',render);
  }
  element('button',app.action??'Update',form,'primary').type='submit';
  form.addEventListener('submit',event=>{event.preventDefault();render();});
  const notes=document.querySelector('#method');
  element('h2','How it works',notes);
  element('p',app.method,notes);
  render();
}
