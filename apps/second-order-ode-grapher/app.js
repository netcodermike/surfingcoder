
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
 title:'Second-Order ODE Grapher',description:'Graph displacement, velocity and phase for linear forced oscillators.',
 controls:[num('a','a · inertia',1,.2,10),num('b','b · damping',.38,0,10,.01),num('c','c · stiffness',2,.1,18),
  num('force','Forcing amplitude',.65,0,12,.01),num('frequency','Forcing angular frequency',1.35,0,9,.01),num('x0','Initial displacement',1,-12,12),
  num('v0','Initial velocity',0,-12,12),num('duration','Time span',20,1,40,1)],
 method:'The equation is a·x″ + b·x′ + c·x = F·cos(ωt). The solver converts it to two coupled first-order equations and advances them with fourth-order Runge–Kutta. A phase portrait plots velocity against displacement.',
 check(){
   const trace=rk4({a:1,b:0,c:1,force:0,frequency:0,x0:1,v0:0,duration:TAU});
   if(trace.some(([t,x,v])=>Math.abs(x-Math.cos(t))>2e-8||Math.abs(v+Math.sin(t))>2e-8))throw Error('RK4 analytic oscillator comparison');
 },
 render(parent,parameters){
   for(const control of this.controls){
     const value=parameters[control.key];
     if(value<control.min||value>control.max)throw new RangeError(control.label+' must be in ['+control.min+', '+control.max+'].');
   }
   const {a,b,c,force,frequency}=parameters;
   badge(parent,fmt(a)+' x″ + '+fmt(b)+' x′ + '+fmt(c)+' x = '+fmt(force)+' cos('+fmt(frequency)+'t)');
   const data=rk4(parameters);
   chart(parent,'Displacement and velocity over time',[
    {name:'Displacement x',points:data.map(([t,x])=>[t,x])},
    {name:'Velocity x′',points:data.map(([t,,v])=>[t,v])}
   ],{xLabel:'Time',yLabel:'Value',height:235});
   chart(parent,'Phase portrait',[{name:'Solution path',points:data.map(([,x,v])=>[x,v])}],{xLabel:'Displacement',yLabel:'Velocity',height:235});
 }
};
