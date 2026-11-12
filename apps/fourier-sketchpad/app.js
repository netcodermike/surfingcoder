
import {range,sum,fmt,element,badge,table,surface,chart,colors,board} from './ui.js';

const number=(key,label,value,min,max,step=1)=>({key,label,value,min,max,step,type:'number'});
const slider=(key,label,value,min,max,step=1)=>({...number(key,label,value,min,max,step),type:'range'});
const select=(key,label,value,options)=>({key,label,value,options,type:'select',live:true});
const pct=x=>fmt(x*100)+'%';
const near=(a,b,t=1e-8)=>Math.abs(a-b)<t;
const bounds=(x,min,max)=>Math.min(max,Math.max(min,x));
function expect(ok,label){if(!ok)throw Error(label);}
function random(seed) {
  return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
}
function binomialData(base,sens,spec){
  return [base*sens,(1-base)*(1-spec),base*(1-sens),(1-base)*spec];
}
function bayesData(base,sens,spec,size){
  const model=binomialData(base,sens,spec), counts=[0,0,0,0], next=random(4804);
  for(let i=0;i<size;i++){
    const condition=next()<base, positive=next()<(condition?sens:1-spec);
    counts[positive?(condition?0:1):(condition?2:3)]++;
  }
  return {model,counts};
}
const harmonics=(weights,x)=>sum(weights.map((w,i)=>w*Math.sin((i+1)*x)));
const distribution=(p,matrix)=>range(p.length).map(j=>sum(p.map((x,i)=>x*matrix[i][j])));
function transitionGraph(parent,matrix) {
  const {ctx,width,height}=surface(parent,'Directed state transition graph. Probabilities appear in the table below.',230);
  const points=matrix.map((_,i)=>{
    const angle=i*Math.PI*2/matrix.length-Math.PI/2;
    return [width/2+Math.cos(angle)*190,height/2+Math.sin(angle)*70];
  });
  for(const [i,row] of matrix.entries()) for(const [j,p] of row.entries()){
    if(p===0)continue;
    const [a,b]=points[i], [x,y]=points[j];
    ctx.strokeStyle=colors[i];ctx.fillStyle=colors[i];ctx.lineWidth=1+p*3;
    if(i===j){
      ctx.beginPath();ctx.arc(a+21,b-10,14,-2,2.55);ctx.stroke();
      continue;
    }
    const d=Math.hypot(x-a,y-b), dx=(x-a)/d,dy=(y-b)/d;
    const bx=x-dx*18-dy*4,by=y-dy*18+dx*4;
    ctx.beginPath();ctx.moveTo(a+dx*18-dy*4,b+dy*18+dx*4);ctx.lineTo(bx,by);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx-10*dx-4*dy,by-10*dy+4*dx);ctx.lineTo(bx-10*dx+4*dy,by-10*dy-4*dx);ctx.fill();
  }
  points.forEach(([x,y],i)=>{
    ctx.beginPath();ctx.arc(x,y,18,0,2*Math.PI);ctx.fillStyle=colors[i];ctx.fill();
    ctx.fillStyle='#141322';ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.fillText(i+1,x,y+5);
  });
}
function markov(raw,start,steps,walks) {
  const m=JSON.parse(raw);
  if(!Array.isArray(m)||m.length<2||m.length>5||m.some(row=>!Array.isArray(row)||row.length!==m.length||row.some(x=>typeof x!=='number'||x<0||x>1)||!near(sum(row),1)))throw new RangeError('Use a 2–5 state square matrix. Each row must sum to one.');
  if(start>=m.length)throw new RangeError('The start state is outside the matrix.');
  let p=range(m.length).map(i=>Number(i===start));
  const history=[p], rng=random(9041), counts=p.map(()=>0);
  for(let t=0;t<steps;t++){p=distribution(p,m);history.push(p);}
  for(let run=0;run<walks;run++){
    let state=start;
    for(let t=0;t<steps;t++){
      let q=rng(), j=0;
      for(;j<m.length-1;j++){q-=m[state][j];if(q<0)break;}
      state=j;
    }
    counts[state]++;
  }
  return {m,p,history,counts};
}
const fractals={
  line:{name:'Diagonal line',base:2,positions:[[0,0],[1,1]]},
  carpet:{name:'Sierpiński carpet',base:3,positions:range(9).filter(i=>i!==4).map(i=>[i%3,Math.floor(i/3)])},
  cantor:{name:'Cantor dust',base:3,positions:[[0,0],[0,2],[2,0],[2,2]]}
};
function fractalData(kind,depth){
  const {base,positions}=fractals[kind], counts=[[1,1]];
  let points=[[0,0]];
  for(let d=1;d<=depth;d++){
    points=points.flatMap(([x,y])=>positions.map(([i,j])=>[x*base+i,y*base+j]));
    counts.push([base**d,points.length]);
  }
  return {points,counts,dimension:Math.log(positions.length)/Math.log(base)};
}
const integrands={
  cubic:{name:'x³',fn:x=>x*x*x,integral:0.25},
  sine:{name:'sin(πx)',fn:x=>Math.sin(Math.PI*x),integral:2/Math.PI},
  gaussian:{name:'eˣ',fn:Math.exp,integral:Math.E-1}
};
function quadrature(f,n){
  const h=1/n;
  const middle=sum(range(n).map(i=>f((i+.5)*h)))*h;
  const inner=range(n-1).map(i=>f((i+1)*h));
  const edges=f(0)+f(1);
  return [middle,(edges/2+sum(inner))*h,(edges+sum(inner.map((v,i)=>v*(i%2?2:4))))*h/3];
}
const mod=(a,m)=>((a%m)+m)%m;
function inverse(a,m){
  let r=m, q=mod(a,m), s=0, t=1;
  while(q){const k=Math.floor(r/q);[r,q]=[q,r-k*q];[s,t]=[t,s-k*t];}
  return r===1?mod(s,m):null;
}
function sieve(n,limit=n){
  const prime=Array(n+1).fill(true);
  prime[0]=prime[1]=false;
  const pivots=[];
  for(let p=2;p*p<=n&&p<=limit;p++)if(prime[p]){
    pivots.push(p);
    for(let k=p*p;k<=n;k+=p)prime[k]=false;
  }
  return {remaining:range(n+1).filter(i=>prime[i]),pivots};
}
function nearest(sites,x,y){
  const distances=sites.map(([a,b])=>Math.hypot(a-x,b-y));
  return {index:distances.indexOf(Math.min(...distances)),distances};
}
export const app={
 title:'Fourier Sketchpad',description:'Combine sinusoidal harmonics and inspect the waveform and its frequency spectrum.',
 controls:range(5).map(i=>slider('a'+i,'Harmonic '+(i+1),[1,0,.42,0,.24][i],-1.5,1.5,.01)),
 method:'The waveform is the sum of the chosen sine terms. The spectrum shows the magnitude of each coefficient. A negative coefficient reverses that sine term.',
 check(){expect(near(harmonics([1,2],Math.PI/2),1)&&near(harmonics([0,2],Math.PI/4),2),'Fourier synthesis');},
 render(p,opt){
   const a=Object.values(opt);
   chart(p,'Combined waveform',[{name:'Sum of harmonics',points:range(257).map(i=>[i/256,harmonics(a,i/256*2*Math.PI)])}],{xLabel:'Cycles',yLabel:'Amplitude'});
   chart(p,'Frequency spectrum',a.map((v,i)=>({name:'Harmonic '+(i+1),points:[[i+1,0],[i+1,Math.abs(v)]]})),{xLabel:'Harmonic number',yLabel:'Magnitude',yBounds:[0,1.5],xBounds:[.5,5.5]});
 }
};
