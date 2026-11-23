const EPSILON = 2e-8;
const maxDegree = 10;
const separators = { '=':'=', '<':'<', '<=':'≤', '>':'>', '>=':'≥' };
const approximate = (a,b) => Math.abs(a-b) <= EPSILON*Math.max(1,Math.abs(a),Math.abs(b));
const simplify = values => {
  const start = values.findIndex(x=>x!==0);
  return start<0 ? [0] : values.slice(start);
};
const identicallyZero = values => values.length===1&&values[0]===0;

export function parsePolynomial(input) {
  const source=input.trim().toLowerCase().replaceAll('−','-');
  if (!source || source.length>220) throw Error('Enter a polynomial up to 220 characters.');
  const number='(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?';
  const valid=new RegExp('^[+-]?'+number+'$');
  function coefficient(text) {
    if (!valid.test(text)) throw Error('Invalid coefficient '+text);
    const x=Number(text);
    if (!Number.isFinite(x) || Math.abs(x)>1e12 || (x!==0&&Math.abs(x)<1e-12))
      throw Error('Coefficient magnitude must be between 0.000000000001 and 1000000000000, or zero.');
    return x;
  }
  if (source.includes(',')) {
    const list=source.split(',').map(part=>coefficient(part.trim()));
    if (list.length>maxDegree+1) throw Error('The maximum degree is 10.');
    return simplify(list);
  }
  const compact=source.replaceAll(/\s+/g,'');
  const term=new RegExp('([+-]?)(?:(?:('+number+')\\*?)?x(?:\\^(\\d+))?|('+number+'))','y');
  const values=Array(maxDegree+1).fill(0);
  let position=0;
  while (position<compact.length) {
    if (position&&compact[position]!=='+'&&compact[position]!=='-') throw Error('Separate terms with + or −.');
    term.lastIndex=position;
    const match=term.exec(compact);
    if (!match) throw Error('Use powers of x or comma-separated coefficients.');
    const [,sign,factor,power,constant]=match;
    const degree=constant!==undefined ? 0 : power===undefined ? 1 : Number(power);
    if (!Number.isInteger(degree)||degree>maxDegree) throw Error('Use integer exponents from 0 to 10.');
    values[maxDegree-degree]+=(sign==='-'?-1:1)*coefficient(constant??factor??'1');
    position=term.lastIndex;
  }
  return simplify(values);
}

export function evaluatePolynomial(coefficients,x) {
  return coefficients.reduce((value,coefficient)=>value*x+coefficient,0);
}
function errorScale(coefficients,x) {
  return coefficients.reduce((value,coefficient)=>value*Math.abs(x)+Math.abs(coefficient),0);
}
const nearZero = (coefficients,x) => Math.abs(evaluatePolynomial(coefficients,x)) <=
  Math.max(Number.MIN_VALUE,errorScale(coefficients,x))*4e-12;

function unique(a) {
  return a.slice().sort((a,b)=>a-b).filter((value,i,values)=>i===0||!approximate(value,values[i-1]));
}

export function realRoots(coefficients) {
  const original=simplify(coefficients);
  if(original.length<2)return [];
  if(original.length===2)return [-original[1]/original[0]];
  const scale=Math.max(...original.map(Math.abs));
  const normalized=original.map(value=>value/scale);
  const limit=1+Math.max(...normalized.slice(1).map(value=>Math.abs(value/normalized[0])));
  const derivative=normalized.slice(0,-1).map((value,i)=>value*(normalized.length-1-i));
  const critical=realRoots(derivative).filter(x=>x> -limit&&x<limit);
  const knots=[-limit,...critical,limit];
  const roots=critical.filter(x=>nearZero(normalized,x));
  for(let i=1;i<knots.length;i++){
    let left=knots[i-1],right=knots[i];
    if((i>1&&nearZero(normalized,left))||(i<knots.length-1&&nearZero(normalized,right)))continue;
    let sign=Math.sign(evaluatePolynomial(normalized,left));
    if(sign===Math.sign(evaluatePolynomial(normalized,right)))continue;
    for(let step=0;step<170;step++){
      const mid=left+(right-left)/2;
      if(mid===left||mid===right)break;
      const side=Math.sign(evaluatePolynomial(normalized,mid));
      if(!side){left=mid;right=mid;break;}
      if(side===sign)left=mid;
      else right=mid;
    }
    roots.push(left+(right-left)/2);
  }
  return unique(roots);
}
function removeFactors(values,root) {
  if (identicallyZero(values)) return {order:Infinity,rest:values};
  let order=0;
  while (values.length>1&&nearZero(values,root)) {
    const reduced=[values[0]];
    for (let i=1;i<values.length-1;i++) reduced.push(values[i]+root*reduced.at(-1));
    values=reduced;
    order++;
  }
  return {order,rest:values};
}

export function analyzeRelation(numerator, denominator, operator, target=0) {
  if (identicallyZero(denominator)) throw Error('The denominator cannot be the zero polynomial.');
  if (!Object.hasOwn(separators,operator)||!Number.isFinite(target)||Math.abs(target)>1e12)
    throw Error('Choose a comparison and a finite target with magnitude at most one trillion.');
  const length=Math.max(numerator.length,denominator.length);
  const equation=simplify(Array.from({length},(_,i)=>
    (numerator[i+numerator.length-length]??0)-target*(denominator[i+denominator.length-length]??0)));
  const all=identicallyZero(equation);
  const excluded=realRoots(denominator);
  const zeros=realRoots(equation);
  const breakpoints=unique([...excluded,...zeros]).map(x=>{
    const hole=excluded.some(value=>approximate(x,value));
    if (!hole) return {x,kind:'root',multiplicity:removeFactors(equation,x).order};
    const {order,rest}=removeFactors(numerator,x);
    const divisor=removeFactors(denominator,x);
    if (order<divisor.order) return {x,kind:'pole'};
    const y=order>divisor.order ? 0 : evaluatePolynomial(rest,x)/evaluatePolynomial(divisor.rest,x);
    return {x,kind:'hole',y};
  });
  const equalAllowed=operator.includes('=');
  const applies=value=>value===0 ? equalAllowed : value<0 ? operator.startsWith('<') : operator.startsWith('>');
  const decisions=[];
  const intervals=[];
  for(let i=0;i<=breakpoints.length;i++){
    const left=breakpoints[i-1]?.x??-Infinity;
    const right=breakpoints[i]?.x??Infinity;
    const sample=Number.isFinite(left)
      ? Number.isFinite(right) ? left+(right-left)/2 : left+Math.max(1,Math.abs(left)*.1)
      : Number.isFinite(right) ? right-Math.max(1,Math.abs(right)*.1) : 0;
    const sign=all?0:Math.sign(evaluatePolynomial(equation,sample))*Math.sign(evaluatePolynomial(denominator,sample));
    const chosen=applies(sign);
    intervals.push({left,right,sign,chosen});
    decisions.push({left,right,closed:false,chosen});
    if(i<breakpoints.length){
      decisions.push({left:right,right,closed:true,chosen:equalAllowed&&breakpoints[i].kind==='root'});
    }
  }
  const solution=[];
  let group;
  for(const choice of decisions){
    if(!choice.chosen){group=undefined;continue;}
    if(!group){
      group={left:choice.left,right:choice.right,leftClosed:choice.closed,rightClosed:choice.closed};
      solution.push(group);
    }else{
      group.right=choice.right;
      group.rightClosed=choice.closed;
    }
  }
  return {breakpoints,intervals,solution};
}

const format = value => Number.isFinite(value) ? Number(value.toPrecision(7)).toString().replace('-','−') :
  value<0?'−∞':'∞';
export function formatSolution(solution) {
  if (!solution.length) return '∅';
  return solution.map(({left,right,leftClosed,rightClosed})=>left===right ? '{'+format(left)+'}' :
    (leftClosed?'[':'(')+format(left)+', '+format(right)+(rightClosed?']':')')).join(' ∪ ');
}

const examples = {
  holes: ['x^3+2x^2-x-2','x^2-4','>=',0,-6,6,-9,9],
  repeated: ['x^4-2x^2+1','1','<=',0,-4,4,-5,8],
  reference: ['x^2-1','x-1','=',3,-5,5,-5,7],
  pole: ['1','x^2-1','>',0,-5,5,-4,4],
};

function initialize() {
  const $=id=>document.getElementById(id);
  const graph=$('plot'),ctx=graph.getContext('2d');
  const width=graph.width,height=graph.height;
  const controls=['numerator','denominator','relation','target','xmin','xmax','ymin','ymax'];
  const label=(text,x,y,color='#d4c2e4')=>{
    ctx.fillStyle=color;ctx.font='15px system-ui';ctx.fillText(text,x,y);
  };
  const line=(x1,y1,x2,y2,color,width=1)=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
  };
  function paint(A,B,result,bounds,target) {
    const [xmin,xmax,ymin,ymax]=bounds;
    const left=67,right=width-26,bottom=height-55,top=32;
    const X=x=>left+(x-xmin)*(right-left)/(xmax-xmin);
    const Y=y=>bottom-(y-ymin)*(bottom-top)/(ymax-ymin);
    ctx.fillStyle='#161121';ctx.fillRect(0,0,width,height);
    for(let i=0;i<=8;i++){
      const x=xmin+(xmax-xmin)*i/8;
      line(X(x),top,X(x),bottom,'#382e48');
      label(format(x),X(x)-8,bottom+22);
    }
    for(let i=0;i<=6;i++){
      const y=ymin+(ymax-ymin)*i/6;
      line(left,Y(y),right,Y(y),'#382e48');
      label(format(y),7,Y(y)+5);
    }
    ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
    for(const row of result.solution){
      if(row.left===row.right)continue;
      const from=Math.max(row.left,xmin),to=Math.min(row.right,xmax);
      if(from>=to)continue;
      ctx.fillStyle='#75e1d321';ctx.fillRect(X(from),top,X(to)-X(from),bottom-top);
    }
    line(X(0),top,X(0),bottom,'#837098',1.6);
    ctx.setLineDash([8,5]);line(left,Y(target),right,Y(target),'#eebc7d',1.5);
    for(const p of result.breakpoints)if(p.kind==='pole')line(X(p.x),top,X(p.x),bottom,'#f09aba',1.4);
    ctx.setLineDash([]);
    const barriers=result.breakpoints.filter(p=>p.kind!=='root').map(p=>p.x);
    let previous,previousX;
    ctx.beginPath();
    for(let i=0;i<=1000;i++){
      const x=xmin+(xmax-xmin)*i/1000,y=evaluatePolynomial(A,x)/evaluatePolynomial(B,x);
      if(!Number.isFinite(y)||Math.abs(y-(ymin+ymax)/2)>30*(ymax-ymin)){previous=undefined;continue;}
      if(previous===undefined||barriers.some(value=>value>previousX&&value<=x))ctx.moveTo(X(x),Y(y));
      else ctx.lineTo(X(x),Y(y));
      previous=y;previousX=x;
    }
    ctx.strokeStyle='#c5a0ff';ctx.lineWidth=3;ctx.stroke();
    for(const p of result.breakpoints){
      if(p.kind==='pole'||p.kind==='hole'&&!Number.isFinite(p.y))continue;
      const y=p.kind==='hole'?p.y:target;
      ctx.beginPath();ctx.arc(X(p.x),Y(y),5,0,2*Math.PI);
      ctx.fillStyle=p.kind==='hole'?'#161121':'#83ead6';ctx.fill();
      ctx.strokeStyle=p.kind==='hole'?'#ffd3ed':'#102820';ctx.lineWidth=2;ctx.stroke();
    }
    ctx.restore();
    label('x',right+8,bottom+15);label('y',left-14,top-8);
  }

  function refresh(){
    try{
      const A=parsePolynomial($('numerator').value);
      const B=parsePolynomial($('denominator').value||'1');
      const comparison=$('relation').value,target=$('target').valueAsNumber;
      const bounds=controls.slice(4).map(id=>$(id).valueAsNumber);
      if (!bounds.every(value=>Number.isFinite(value)&&Math.abs(value)<=1e6)||
          !(bounds[0]<bounds[1]&&bounds[2]<bounds[3])) throw Error('Use increasing finite plot bounds within ±1,000,000.');
      const report=analyzeRelation(A,B,comparison,target);
      paint(A,B,report,bounds,target);
      $('reading').textContent='Solution  '+formatSolution(report.solution);
      $('error').textContent='';
      const points=report.breakpoints.map(point=>{
        const item=document.createElement('li');
        const detail=point.kind==='hole'?'hole, excluded':point.kind==='pole'?'pole, excluded':
          'solution boundary'+(point.multiplicity>1?', multiplicity '+point.multiplicity:'');
        item.textContent='x = '+format(point.x)+' · '+detail;
        return item;
      });
      $('breakpoints').replaceChildren(...points);
      $('no-breakpoints').hidden=points.length>0;
      $('sign-rows').replaceChildren(...report.intervals.map(({left,right,sign,chosen})=>{
        const row=document.createElement('tr');
        for(const value of ['('+format(left)+', '+format(right)+')',sign>0?'+':sign<0?'−':'0',chosen?'Yes':'No']) {
          const cell=row.insertCell();cell.textContent=value;
        }
        return row;
      }));
    }catch(problem){ $('error').textContent=problem.message; }
  }
  function preset(name){
    controls.forEach((id,i)=>{ $(id).value=examples[name][i]; });
    refresh();
  }
  $('example').onchange=()=>preset($('example').value);
  $('controls').onsubmit=event=>{event.preventDefault();refresh();};
  preset('holes');
}
if (typeof document !== 'undefined') initialize();
