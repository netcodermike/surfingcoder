import {solve} from './simplex.js';
export const scenarios=[
  {name:'Good weather',p:.4,soy:70,corn:60,wheat:40},
  {name:'Drought',p:.2,soy:-10,corn:-15,wheat:0},
  {name:'Flood',p:.1,soy:15,corn:20,wheat:10},
  {name:'Early frost',p:.15,soy:50,corn:40,wheat:30},
  {name:'Drought + frost',p:.1,soy:-15,corn:-20,wheat:-10},
  {name:'Flood + frost',p:.05,soy:10,corn:10,wheat:5}
];
export const defaults={land:640,budget:20000,winter:4000,summer:4500,cowValue:30000,weather:'expected'};
export function expected(weather=scenarios){
  const total=weather.reduce((s,r)=>s+r.p,0);if(Math.abs(total-1)>1e-8||weather.some(r=>r.p<0||!Number.isFinite(r.p)))throw Error('Weather probabilities must be nonnegative and sum to 1.');
  return Object.fromEntries(['soy','corn','wheat'].map(k=>[k,weather.reduce((s,r)=>s+r.p*r[k],0)]));
}
export function farmModel(settings=defaults,weather=scenarios){
  const p={...defaults,...settings};
  if(['land','budget','winter','summer','cowValue'].some(k=>!Number.isFinite(p[k])||p[k]<0||p[k]>1e7))throw Error('Farm resources must be finite, nonnegative, and at most 10 million.');
  expected(weather);
  const crop=p.weather==='expected'?expected(weather):weather[Number(p.weather)];if(!crop)throw Error('Choose a valid weather scenario.');
  return {sense:'max',names:['Cows','Hens','Soy','Corn','Wheat','Winter work','Summer work'],c:[700,3.5,crop.soy,crop.corn,crop.wheat,5,5.5],constant:850*30+4.25*2000+p.budget+.9*p.cowValue+.75*5000-40000,
    constraints:[
      {name:'Cow capacity',a:[1,0,0,0,0,0,0],op:'<=',b:12},
      {name:'Hen capacity',a:[0,1,0,0,0,0,0],op:'<=',b:3000},
      {name:'Corn for cows',a:[-1,0,0,1,0,0,0],op:'>=',b:30},
      {name:'Wheat for hens',a:[0,-.05,0,0,1,0,0],op:'>=',b:100},
      {name:'Purchase budget',a:[1500,3,0,0,0,0,0],op:'<=',b:p.budget},
      {name:'Farm acreage',a:[2,0,1,1,1,0,0],op:'<=',b:p.land-60},
      {name:'Winter / spring hours',a:[60,.3,1,.9,.6,1,0],op:'=',b:p.winter-2400},
      {name:'Summer / fall hours',a:[60,.3,1.4,1.2,.7,0,1],op:'=',b:p.summer-2400}
    ]};
}
export const worth=(model,x)=>model.constant+model.c.reduce((s,c,i)=>s+c*x[i],0);
export function compareWeather(settings=defaults,weather=scenarios){
  const plans=weather.map((_,i)=>solve(farmModel({...settings,weather:String(i)},weather),{trace:false}));
  const outcomes=plans.map(plan=>plan.status==='optimal'?weather.map((_,i)=>worth(farmModel({...settings,weather:String(i)},weather),plan.x)):null);
  const summaries=outcomes.map(row=>row?{expected:row.reduce((s,v,i)=>s+v*weather[i].p,0),worst:Math.min(...row),best:Math.max(...row)}:null);
  return {plans,outcomes,summaries};
}
export const examples={
  production:{sense:'max',names:['Boards','Benches'],c:[40,30],constraints:[{name:'Wood',a:[2,1],op:'<=',b:40},{name:'Workshop hours',a:[1,2],op:'<=',b:50}]},
  minimum:{sense:'min',names:['Blend A','Blend B'],c:[3,2],constraints:[{name:'Nutrition',a:[1,1],op:'>=',b:4},{name:'Protein',a:[2,1],op:'>=',b:5}]},
  infeasible:{sense:'max',c:[1],constraints:[{a:[1],op:'<=',b:1},{a:[1],op:'>=',b:2}]},
  unbounded:{sense:'max',c:[1,1],constraints:[{a:[1,-1],op:'<=',b:2}]}
};
