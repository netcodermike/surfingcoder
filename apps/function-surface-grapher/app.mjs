const functions = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, abs: Math.abs,
  exp: Math.exp, log: Math.log, log10: Math.log10, asin: Math.asin, acos: Math.acos, atan: Math.atan,
};
const operators = {
  '+': (a, b) => a + b, '-': (a, b) => a - b,
  '*': (a, b) => a * b, '/': (a, b) => a / b, '^': (a, b) => a ** b,
};
const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };

export function compileExpression(source, variables = ['x']) {
  const text = source.trim().replaceAll('−', '-').toLowerCase();
  if (!text || text.length > 256) throw Error('Enter an expression of 1 to 256 characters.');
  const tokens = [];
  let position = 0;
  while (position < text.length) {
    const token = /\s+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z][a-z0-9]*|[()+*/^\-]/y;
    token.lastIndex = position;
    const match = token.exec(text);
    if (!match) throw Error('Unexpected character ' + text[position]);
    position = token.lastIndex;
    if (match[0].trim()) tokens.push(match[0]);
  }
  let index = 0;
  function atom() {
    const token = tokens[index++];
    if (token === '+' || token === '-') {
      const operand = expression(3);
      return values => token === '-' ? -operand(values) : operand(values);
    }
    if (token === '(') {
      const body = expression(1);
      if (tokens[index++] !== ')') throw Error('Add the closing parenthesis.');
      return body;
    }
    if (!token) throw Error('Expected a number, variable, or function.');
    if (Number.isFinite(Number(token))) return () => Number(token);
    if (variables.includes(token)) return values => values[token];
    if (token === 'pi') return () => Math.PI;
    if (token === 'e') return () => Math.E;
    if (!Object.hasOwn(functions, token)) throw Error('Unknown name or number ' + token);
    if (tokens[index++] !== '(') throw Error('Put parentheses after ' + token + '.');
    const body = expression(1);
    if (tokens[index++] !== ')') throw Error('Add the closing parenthesis.');
    return values => functions[token](body(values));
  }
  function expression(level) {
    let left = atom();
    while (Object.hasOwn(precedence, tokens[index]) && precedence[tokens[index]] >= level) {
      const operator = tokens[index++];
      const before = left;
      const right = expression(precedence[operator] + (operator === '^' ? 0 : 1));
      left = values => operators[operator](before(values), right(values));
    }
    return left;
  }
  const evaluate = expression(1);
  if (index !== tokens.length) throw Error('Use * for multiplication and check parentheses.');
  return (x, y = 0) => evaluate({ x, y });
}

export function validateDomain(xmin, xmax, ymin, ymax) {
  if (![xmin, xmax, ymin, ymax].every(x => Number.isFinite(x) && Math.abs(x) <= 1e6) ||
      xmax - xmin < .00001 || ymax - ymin < .00001) {
    throw Error('Each axis needs increasing bounds between −1,000,000 and 1,000,000.');
  }
  return { xmin, xmax, ymin, ymax };
}

export function surfaceSamples(evaluate, domain, steps = 30) {
  const { xmin, xmax, ymin, ymax } = domain;
  return Array.from({length: steps+1}, (_, i) => Array.from({length: steps+1}, (_, j) => {
    const z = evaluate(xmin+(xmax-xmin)*j/steps, ymin+(ymax-ymin)*i/steps);
    return {x: 2*j/steps-1, y: 2*i/steps-1, z: Number.isFinite(z) ? z : null};
  }));
}

const examples = {
  ripple: ['3d', '2*sin(sqrt(x^2+y^2))', -8, 8, -8, 8],
  saddle: ['3d', 'x^2-y^2', -3, 3, -3, 3],
  hills: ['3d', 'cos(x)*sin(y)', -6, 6, -6, 6],
  sine: ['2d', 'sin(x)+0.4*cos(3*x)', -9, 9, -2, 2],
  cubic: ['2d', 'x^3-3*x', -4, 4, -8, 8],
  reciprocal: ['2d', '1/x', -6, 6, -4, 4],
};

function initialize() {
  const $ = id => document.getElementById(id);
  const chart = $('plot'), ctx = chart.getContext('2d');
  const W = chart.width, H = chart.height;
  const axes = ['xmin','xmax','ymin','ymax'];
  const reading = $('reading'), error = $('error');
  let model, yaw = -.65, pitch = .57, drag;
  const fmt = n => Number(n.toPrecision(5)).toString().replace('-', '−');
  function line(points, color = '#785e90', width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.stroke();
  }
  function label(text,x,y,color='#d7c6e8') {
    ctx.fillStyle=color;
    ctx.font='15px system-ui';
    ctx.fillText(text,x,y);
  }
  function paint2d({evaluate, domain}) {
    const {xmin,xmax,ymin,ymax}=domain;
    const left=72,right=W-30,bottom=H-55,top=29;
    const X=x => left+(x-xmin)*(right-left)/(xmax-xmin);
    const Y=y => bottom-(y-ymin)*(bottom-top)/(ymax-ymin);
    const grid = (min,max) => {
      const spacing=(max-min)/7, magnitude=10**Math.floor(Math.log10(spacing));
      const step=[1,2,5,10].find(n=>n*magnitude>=spacing)*magnitude;
      const values=[];
      for(let i=Math.ceil(min/step);i*step<=max && values.length<10;i++)values.push(i*step);
      return values;
    };
    for(const x of grid(xmin,xmax)) {
      line([[X(x),top],[X(x),bottom]],x===0?'#ac93c5':'#392d46');
      label(fmt(x),X(x)-9,bottom+21);
    }
    for(const y of grid(ymin,ymax)) {
      line([[left,Y(y)],[right,Y(y)]],y===0?'#ac93c5':'#392d46');
      label(fmt(y),9,Y(y)+5);
    }
    label('x',right+8,bottom+15); label('y',left-18,top-9);
    ctx.save();
    ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
    ctx.strokeStyle='#78e8de';ctx.lineWidth=3;
    ctx.beginPath();
    let previous=null;
    for(let i=0;i<=960;i++) {
      const x=xmin+(xmax-xmin)*i/960,y=evaluate(x);
      if(!Number.isFinite(y)||Math.abs(y-(ymax+ymin)/2)>12*(ymax-ymin)){previous=null;continue;}
      if(previous===null||Math.abs(y-previous)>.75*(ymax-ymin))ctx.moveTo(X(x),Y(y));
      else ctx.lineTo(X(x),Y(y));
      previous=y;
    }
    ctx.stroke();ctx.restore();
  }
  function paint3d({samples, limits}) {
    const [low, high] = limits;
    const span=high-low;
    const scale=Math.min(W,H)*.305;
    const project=(x,y,z) => {
      const ix=x*Math.cos(yaw)-y*Math.sin(yaw);
      const iy=x*Math.sin(yaw)+y*Math.cos(yaw);
      return [W*.50+ix*scale,H*.51+(iy*Math.sin(pitch)-z*Math.cos(pitch))*scale,
        iy*Math.cos(pitch)+z*Math.sin(pitch)];
    };
    const projected=samples.map(row=>row.map(({x,y,z})=>z===null?null:project(x,y,span ? (z-low)/span*1.55-.775 : 0)));
    const tiles=[];
    for(let row=0;row<projected.length-1;row++){
      for(let col=0;col<projected[row].length-1;col++){
        const points=[projected[row][col],projected[row][col+1],projected[row+1][col+1],projected[row+1][col]];
        if(points.some(p=>p===null))continue;
        const z=samples[row][col].z;
        tiles.push({points,depth:points.reduce((s,p)=>s+p[2],0),hue:span ? 192+87*(z-low)/span : 235});
      }
    }
    tiles.sort((a,b)=>a.depth-b.depth);
    const axes=[['x',project(1.23,-1,-.92),'#9fe8e0'],['y',project(-1,1.23,-.92),'#edc8ff'],['z',project(-1,-1,1.13),'#ffd4a2']];
    for(const [,point,color] of axes)line([project(-1,-1,-.92),point],color,1.6);
    for(const {points,hue} of tiles){
      ctx.beginPath();
      points.forEach(([x,y],i)=>i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
      ctx.closePath();
      ctx.fillStyle='hsl('+hue+' 69% 50%)';ctx.fill();
      ctx.strokeStyle='rgba(235,225,253,.37)';ctx.lineWidth=.85;ctx.stroke();
    }
    for(const [name,[x,y],color] of axes)label(name,x+5,y-4,color);
    label('Sampled z range  '+fmt(low)+' to '+fmt(high),18,H-23);
  }
  function paint() {
    ctx.fillStyle='#161121';ctx.fillRect(0,0,W,H);
    if(!model)return;
    if(model.mode==='2d')paint2d(model);
    else paint3d(model);
  }
  function refresh() {
    try {
      const mode=$('mode').value;
      const domain=validateDomain(...axes.map(id=>$(id).valueAsNumber));
      const evaluate=compileExpression($('formula').value, mode==='2d'?['x']:['x','y']);
      let samples, limits;
      if(mode==='3d'){
        samples=surfaceSamples(evaluate,domain);
        const values=samples.flat().map(point=>point.z).filter(Number.isFinite);
        if(!values.length)throw Error('The surface has no finite points in these bounds.');
        limits=[Math.min(...values),Math.max(...values)];
        if(!Number.isFinite(limits[1]-limits[0]))throw Error('Surface values exceed the plot range.');
      }
      model={mode,domain,evaluate,samples,limits};
      error.textContent='';
      $('rotate-controls').hidden=mode!=='3d';
      reading.textContent=(mode==='3d'?'z = ':'y = ')+$('formula').value;
      chart.setAttribute('aria-label',(mode==='3d'?'3D surface for z = ':'2D graph for y = ')+$('formula').value);
      chart.style.cursor='grab';
      paint();
    }catch(problem){error.textContent=problem.message;}
  }
  function setDomain(values) {
    axes.forEach((id,i)=>{ $(id).value=Number(values[i].toPrecision(8)); });
  }
  function setExample(name) {
    const [mode,expr,...bounds]=examples[name];
    $('mode').value=mode;$('formula').value=expr;setDomain(bounds);
    yaw=-.65;pitch=.57;refresh();
  }
  $('example').addEventListener('change',()=>setExample($('example').value));
  $('mode').addEventListener('change',()=> {
    const example=$('mode').value==='2d'?'sine':'ripple';
    $('example').value=example;setExample(example);
  });
  $('controls').addEventListener('submit',event=>{event.preventDefault();refresh();});
  function zoom(factor) {
    if(!model)return;
    const {xmin,xmax,ymin,ymax}=model.domain;
    const adjust=(min,max)=>[(min+max)/2-(max-min)*factor/2,(min+max)/2+(max-min)*factor/2];
    setDomain([...adjust(xmin,xmax),...adjust(ymin,ymax)]);refresh();
  }
  $('zoom-in').onclick=()=>zoom(.8);
  $('zoom-out').onclick=()=>zoom(1.25);
  $('turn-left').onclick=()=>{yaw-=.27;paint();};
  $('turn-right').onclick=()=>{yaw+=.27;paint();};
  chart.addEventListener('pointerdown',event=>{
    if(event.button!==0||!model)return;
    drag={x:event.clientX,y:event.clientY,yaw,pitch,domain:model.domain};
    chart.setPointerCapture(event.pointerId);chart.style.cursor='grabbing';
  });
  chart.addEventListener('pointermove',event=>{
    if(!drag)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(model.mode==='3d'){
      yaw=drag.yaw+dx*.009;
      pitch=Math.max(.13,Math.min(1.45,drag.pitch+dy*.008));
      paint();
    }else{
      const {xmin,xmax,ymin,ymax}=drag.domain;
      const a=-dx*(xmax-xmin)/chart.clientWidth,b=dy*(ymax-ymin)/chart.clientHeight;
      setDomain([xmin+a,xmax+a,ymin+b,ymax+b]);refresh();
    }
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']) {
    chart.addEventListener(event,()=>{drag=undefined;chart.style.cursor='grab';});
  }
  setExample('ripple');
}
if (typeof document !== 'undefined') initialize();
