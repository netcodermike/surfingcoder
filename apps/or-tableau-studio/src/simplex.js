// Original educational implementation. Tableau row convention: z - c*x = 0.
export const EPS = 1e-9;
const copy = x => structuredClone(x);
const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
export function validate(model) {
  if (!model || !['max','min'].includes(model.sense)) throw Error('sense must be max or min.');
  const n=model.c?.length, m=model.constraints?.length;
  if (!Number.isInteger(n)||n<1||n>12||!Number.isInteger(m)||m<1||m>24) throw Error('Use 1–12 variables and 1–24 constraints.');
  const number=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e8;
  if (!model.c.every(number)||!number(model.constant??0)) throw Error('Coefficients must be finite numbers with magnitude at most 100 million.');
  for(const r of model.constraints) if(!Array.isArray(r.a)||r.a.length!==n||!r.a.every(number)||!number(r.b)||!['<=','>=','='].includes(r.op)) throw Error('Each constraint needs n numeric coefficients, op <= / >= / =, and numeric b.');
  if(model.names && (model.names.length!==n||!model.names.every(s=>typeof s==='string'&&s.length>0&&s.length<=40)||new Set(model.names).size!==n)) throw Error('Variable names must be unique strings, 1–40 characters.');
  return model;
}
function interval(values, slopes) {
  let low=-Infinity, high=Infinity;
  values.forEach((v,i)=>{const a=slopes[i]; if(a>EPS) low=Math.max(low,-v/a);else if(a < -EPS) high=Math.min(high,-v/a);});
  return [low,high];
}
export function solve(input,{limit=1000,trace=true}={}) {
  const model=copy(validate(input)), n=model.c.length, m=model.constraints.length, dir=model.sense==='max'?1:-1;
  const names=model.names??model.c.map((_,i)=>'x'+(i+1));
  const columns=names.map((name,i)=>({name,kind:'decision',original:i})), artificial=new Set(), basis=[], flips=[];
  const rows=model.constraints.map((r,i)=>{const flip=r.b < 0?-1:1;flips.push(flip);return {a:r.a.map(v=>v*flip),b:r.b*flip,op:flip===1?r.op:r.op==='<='?'>=':r.op==='>='?'<=':'=',id:i};});
  rows.forEach((r,i)=>{
    if(r.op!=='='){r.slack=columns.length;columns.push({name:(r.op==='<='?'s':'u')+(i+1),kind:r.op==='<='?'slack':'surplus',row:i});}
    if(r.op==='<=' )basis.push(r.slack);
    else {basis.push(columns.length);artificial.add(columns.length);columns.push({name:'a'+(i+1),kind:'artificial',row:i});}
  });
  let cols=columns, table=rows.map((r,i)=>{const a=Array(cols.length+1).fill(0);r.a.forEach((v,j)=>a[j]=v);if(r.slack!==undefined)a[r.slack]=r.op==='<='?1:-1;if(artificial.has(basis[i]))a[basis[i]]=1;a[cols.length]=r.b;return a;});
  let transform=rows.map((_,i)=>Array.from({length:m},(_,j)=>i===j?1:0)), obj=[], costs=[], phase='I', pivots=0;
  const history=[], redundantTransforms=[];
  function objective(c) {costs=c;obj=[...c.map(v=>-v),0];table.forEach((row,i)=>{const cb=c[basis[i]];row.forEach((v,j)=>obj[j]+=cb*v);});}
  function pivot(row,col) {
    const q=table[row][col];table[row]=table[row].map(v=>v/q);transform[row]=transform[row].map(v=>v/q);
    table.forEach((r,i)=>{if(i!==row){const a=r[col];table[i]=r.map((v,j)=>v-a*table[row][j]);transform[i]=transform[i].map((v,j)=>v-a*transform[row][j]);}});
    const a=obj[col];obj=obj.map((v,j)=>v-a*table[row][j]);basis[row]=col;pivots++;
  }
  function snapshot(message, next=null) {if(trace)history.push({phase,message,columns:copy(cols),basis:[...basis],rows:copy(table),objective:[...obj],next,pivots});}
  function run() {
    while(true) {
      // Bland: smallest column index; ratio ties use the smallest basic index.
      const col=obj.findIndex((v,j)=>j<cols.length&&v < -EPS);
      if(col<0){snapshot('No improving reduced costs remain in this phase.');return 'optimal';}
      let row=-1, ratio=Infinity;
      table.forEach((r,i)=>{if(r[col]>EPS){const t=Math.max(0,r.at(-1))/r[col];if(t<ratio-EPS||(Math.abs(t-ratio)<=EPS&&(row<0||basis[i]<basis[row]))){row=i;ratio=t;}}});
      if(row<0){snapshot('An improving column has no positive pivot entry: unbounded direction.');return 'unbounded';}
      if(pivots>=limit){snapshot('Iteration limit reached.');return 'iteration_limit';}
      const next={row,col,ratio,entering:cols[col].name,leaving:cols[basis[row]].name,ratios:table.map(r=>r[col]>EPS?Math.max(0,r.at(-1))/r[col]:null)};
      snapshot(`${next.entering} enters; ${next.leaving} leaves. Minimum nonnegative ratio ${ratio.toPrecision(6)}.`,next);pivot(row,col);
      if(!table.flat().every(Number.isFinite)||!obj.every(Number.isFinite))return 'numerical_issue';
    }
  }
  if(artificial.size) {
    objective(cols.map((_,i)=>artificial.has(i)?-1:0));
    const status=run();if(status!=='optimal')return {status:status==='unbounded'?'numerical_issue':status,history};
    if(obj.at(-1)<-1e-7)return {status:'infeasible',history,phaseOneResidual:-obj.at(-1)};
    // Pivot zero artificial basics out, or discard an equation redundant in the remaining columns.
    for(let i=table.length-1;i>=0;i--)if(artificial.has(basis[i])) {
      const j=table[i].findIndex((v,j)=>j<cols.length&&!artificial.has(j)&&Math.abs(v)>EPS);
      if(j>=0){if(pivots>=limit)return {status:'iteration_limit',history};snapshot('Remove a zero-valued artificial basic variable.',{row:i,col:j,entering:cols[j].name,leaving:cols[basis[i]].name,ratios:[]});pivot(i,j);}
      else {redundantTransforms.push([...transform[i]]);table.splice(i,1);basis.splice(i,1);transform.splice(i,1);}
    }
    const keep=cols.map((_,i)=>i).filter(i=>!artificial.has(i)), map=new Map(keep.map((old,i)=>[old,i]));
    table=table.map(r=>[...keep.map(i=>r[i]),r.at(-1)]);basis.forEach((b,i)=>basis[i]=map.get(b));cols=keep.map(i=>cols[i]);
  }
  phase='II';objective(cols.map(c=>c.kind==='decision'?dir*model.c[c.original]:0));
  const status=run();if(status!=='optimal')return {status,history};
  const x=Array(n).fill(0);basis.forEach((b,i)=>{if(cols[b].kind==='decision')x[cols[b].original]=Math.max(0,table[i].at(-1));});
  const value=dot(model.c,x)+(model.constant??0);
  const y=Array(m).fill(0);table.forEach((_,i)=>transform[i].forEach((v,j)=>y[j]+=costs[basis[i]]*v));
  const dual=y.map((v,i)=>v*flips[i]*dir);
  const residuals=model.constraints.map((r,i)=>{const lhs=dot(r.a,x),slack=r.op==='<='?r.b-lhs:r.op==='>='?lhs-r.b:r.b-lhs;return {name:r.name??'Constraint '+(i+1),lhs,rhs:r.b,slack,dual:dual[i],binding:Math.abs(slack)<1e-6};});
  if(residuals.some((r,i)=>model.constraints[i].op==='='?Math.abs(r.slack)>1e-6*Math.max(1,Math.abs(r.rhs)):r.slack < -1e-6*Math.max(1,Math.abs(r.rhs))))return {status:'numerical_issue',history};
  const nonbasic=cols.map((_,j)=>j).filter(j=>!basis.includes(j));
  const sensitivity=model.c.map((c,k)=>{
    const row=basis.indexOf(k);let delta;
    if(row<0)delta=[-Infinity,obj[k]];
    else delta=interval(nonbasic.map(j=>Math.max(0,obj[j])),nonbasic.map(j=>table[row][j]));
    const ends=delta.map(d=>c+dir*d).sort((a,b)=>a-b);
    return {name:names[k],coefficient:c,low:ends[0],high:ends[1],reducedCost:-obj[k]*dir};
  });
  const rhsRanges=model.constraints.map((r,j)=>{
    const range=interval([...table.map(r=>Math.max(0,r.at(-1))),...redundantTransforms.map(()=>0)],[...transform.map(r=>r[j]*flips[j]),...redundantTransforms.map(r=>r[j]*flips[j])]);
    return {name:r.name??'Constraint '+(j+1),low:r.b+range[0],high:r.b+range[1]};
  });
  return {status,value,x,names,history,pivots,residuals,sensitivity,rhsRanges,dual};
}
