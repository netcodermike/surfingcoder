
import {range,fmt,element,badge,chart,surface} from './ui.js';

const num=(key,label,value,min,max,step=.1)=>({key,label,value,min,max,step,type:'number'});
const choose=(key,label,value,options)=>({key,label,value,options,type:'select',live:true});
const TAU=2*Math.PI;
export function rk4({a,b,c,force,frequency,x0,v0,duration},dt=.0125){
  const n=Math.ceil(duration/dt), h=duration/n;
  let x=x0,v=v0;
  const data=[[0,x,v]];
  const acceleration=(t,x,v)=>(force*Math.cos(frequency*t)-b*v-c*x)/a;
  for(const i of range(n)){
    const t=i*h;
    const v1=v,k1=acceleration(t,x,v);
    const v2=v+h*k1/2,k2=acceleration(t+h/2,x+h*v1/2,v2);
    const v3=v+h*k2/2,k3=acceleration(t+h/2,x+h*v2/2,v3);
    const v4=v+h*k3,k4=acceleration(t+h,x+h*v3,v4);
    x+=h*(v1+2*v2+2*v3+v4)/6;v+=h*(k1+2*k2+2*k3+k4)/6;
    data.push([(i+1)*h,x,v]);
  }
  return data;
}

const profiles={
 sine:{name:'Sine mode',fixed:x=>Math.sin(Math.PI*x),periodic:x=>Math.sin(TAU*x)},
 pulse:{name:'Smooth pulse',fixed:x=>Math.sin(Math.PI*x)*Math.exp(-105*(x-.43)**2),periodic:x=>Math.exp(-105*(x-.43)**2)},
 mix:{name:'Mixed modes',fixed:x=>.75*Math.sin(Math.PI*x)+.26*Math.sin(4*Math.PI*x),periodic:x=>.75*Math.sin(TAU*x)+.26*Math.sin(3*TAU*x)}
};
export function solvePde({equation,boundary,profile,rate,duration},n=80){
  const periodic=boundary==='periodic', count=n+Number(!periodic), dx=1/n;
  const heat=equation==='heat', cap=heat?.44*dx*dx/rate:.85*dx/rate;
  const frameCount=100, substeps=Math.ceil(duration/(frameCount*cap)), dt=duration/(frameCount*substeps);
  const alpha=heat?rate*dt/(dx*dx):(rate*dt/dx)**2;
  const sample=profiles[profile][boundary];
  let u=Float64Array.from(range(count),i=>!periodic&&(i===0||i===n)?0:sample(i*dx));
  let past=u.slice(), future=u.slice();
  const frames=[u.slice()];
  for(let t=0;t<frameCount*substeps;t++){
    for(let j=periodic?0:1;j<n;j++){
      const left=u[(j-1+count)%count],right=u[(j+1)%count];
      const lap=left-2*u[j]+right;
      future[j]=heat?u[j]+alpha*lap:t===0?u[j]+.5*alpha*lap:2*u[j]-past[j]+alpha*lap;
    }
    [past,u,future]=[u,future,past];
    if((t+1)%substeps===0)frames.push(u.slice());
  }
  return {frames,dx,dt,alpha};
}
function fieldColor(u,peak){
  const k=Math.min(1,Math.abs(u)/peak);
  const high=u<0?[197,148,255]:[71,242,218], low=[22,24,47];
  return 'rgb('+high.map((v,i)=>Math.round(low[i]+(v-low[i])*k)).join(',')+')';
}
export const app={
 title:'PDE Wave and Heat Explorer',description:'Animate how a temperature profile diffuses or a wave travels and reflects.',
 controls:[choose('equation','Equation','wave',[['wave','Wave equation'],['heat','Heat equation']]),
  choose('boundary','Boundary','fixed',[['fixed','Fixed zero ends'],['periodic','Periodic']]),
  choose('profile','Initial profile','mix',Object.entries(profiles).map(([k,v])=>[k,v.name])),
  num('rate','Wave speed or thermal diffusivity',.45,.02,1,.01),num('duration','Time span',2,.2,4,.1)],
 method:'On [0, 1], the heat model uses uₜ = αuₓₓ and the wave model uses uₜₜ = c²uₓₓ with zero initial velocity. The finite differences use stable time steps for the selected grid and coefficient.',
 check(){
   const rate=.2,duration=.7;
   for(const equation of ['heat','wave'])for(const boundary of ['fixed','periodic']){
     const {frames,dx}=solvePde({equation,boundary,profile:'sine',rate,duration});
     const k=boundary==='fixed'?Math.PI:TAU;
     const amplitude=equation==='heat'?Math.exp(-rate*k*k*duration):Math.cos(rate*k*duration);
     const err=Math.max(...frames.at(-1).map((v,i)=>Math.abs(v-amplitude*Math.sin(k*i*dx))));
     if(err>.0025)throw Error(equation+' analytic mode error '+err);
   }
 },
 render(parent,opts,state){
   if(opts.rate<.02||opts.rate>1||opts.duration<.2||opts.duration>4)throw new RangeError('Use a coefficient of 0.02–1 and time span of 0.2–4.');
   const {frames,dx,dt,alpha}=solvePde(opts);
   const peak=Math.max(1,...frames.map(u=>Math.max(...u.map(Math.abs))));
   badge(parent,(opts.equation==='heat'?'Diffusion ratio ':'Courant number ')+fmt(opts.equation==='heat'?alpha:Math.sqrt(alpha))+' · Time step '+fmt(dt));
   const toolbar=element('div',null,parent,'answer');
   const play=element('button','Play',toolbar);
   const label=element('label','Time',toolbar), seek=element('input',null,label);
   seek.type='range';seek.min=0;seek.max=100;seek.value=state.frame??32;
   const clock=element('output','',label);
   const plot=element('div',null,parent);
   const display=()=>{
     const i=+seek.value;state.frame=i;clock.value='t = '+fmt(i/100*opts.duration);
     plot.replaceChildren();
     const u=Array.from(frames[i]);if(opts.boundary==='periodic')u.push(u[0]);
     chart(plot,'Spatial profile',[{name:'u(x, t)',points:u.map((v,j)=>[j*dx,v])}],{xLabel:'Position',yLabel:'u',height:215,yBounds:[-peak,peak]});
   };
   display();
   element('h2','Space–time heatmap',parent);
   const {ctx,width,height}=surface(parent,'Position on the horizontal axis, time on the vertical axis',230);
   const w=width-70,h=height-38,x0=48,y0=8;
   for(const [i,u] of frames.entries())for(const [j,value] of u.entries()){
     ctx.fillStyle=fieldColor(value,peak);
     ctx.fillRect(x0+j*w/u.length,y0+(100-i)*h/101,w/u.length+1,h/101+1);
   }
   ctx.fillStyle='#ddd9ee';ctx.font='12px system-ui';ctx.fillText('t = 0',8,y0+h);ctx.fillText('t = '+fmt(opts.duration),5,y0+12);
   ctx.fillText('x = 0',x0,height-8);ctx.fillText('x = 1',x0+w-27,height-8);
   element('p','Purple is negative, dark is near zero, and turquoise is positive.',parent);
   let timer;
   const stop=()=>{clearInterval(timer);timer=null;play.textContent='Play';};
   seek.oninput=display;
   play.onclick=()=>{
     if(timer){stop();return;}
     if(+seek.value>=100)seek.value=0;
     display();play.textContent='Pause';
     timer=setInterval(()=>{seek.value=+seek.value+1;display();if(+seek.value>=100)stop();},45);
   };
   return stop;
 }
};
