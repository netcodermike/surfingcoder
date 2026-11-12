
import {range,sum,fmt,element,badge,table,colors,download} from './ui.js';

const divisions={
 'New England':'CT ME MA NH RI VT','Mid-Atlantic':'NJ NY PA',
 'East North Central':'IL IN MI OH WI','West North Central':'IA KS MN MO NE ND SD',
 'South Atlantic':'DE DC FL GA MD NC SC VA WV','East South Central':'AL KY MS TN',
 'West South Central':'AR LA OK TX','Mountain':'AZ CO ID MT NV NM UT WY','Pacific':'AK CA HI OR WA'
};
const states=new Map(Object.entries(divisions).flatMap(([division,codes])=>codes.split(' ').map(code=>[code,division])));
const attributes={
 Nutrition:['WIC','WICCash','SFMNP','SNAP'],
 Food:['BakedGoods','Cheese','Seafood','Fruit','Herbs','Vegetables','Honey','Jams','Maple','Meat','Nuts','Prepared'],
 Plants:['Plants','Flowers'],Crafts:['Crafts','Soap']
};
const fields=Object.keys(attributes);
const sourceColumns=['State',...Object.values(attributes).flat()];
const known=['Y','N',''];
const sampleData=(()=>{
 const rows=[];
 let seed=9927;
 const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 for(const [i,[code]] of [...states].entries())for(let j=0;j<6;j++){
   const offer=random()<.25+(i%5)*.12, nutrition=random()<.22+(i%4)*.14;
   const record=Object.fromEntries(sourceColumns.map(k=>[k,'N']));
   Object.assign(record,{State:code,Fruit:random()<.8?'Y':'N',Plants:offer?'Y':'N',Crafts:random()<(offer?.76:.19)?'Y':'N',SNAP:nutrition?'Y':'N',WIC:random()<.1?'Y':'N',Flowers:offer&&random()<.6?'Y':'N',Vegetables:random()<.6?'Y':'N',Soap:random()<.1?'Y':'N'});
   rows.push(record);
 }
 return rows;
})();
const sampleCsv=()=>[sourceColumns.join(','),...sampleData.map(row=>sourceColumns.map(k=>row[k]).join(','))].join('\n');

export function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false,closed=false;
 function push(){row.push(field);field='';closed=false;}
 function line(){push();if(row.some(x=>x.trim()))rows.push(row);row=[];}
 for(let i=0;i<text.length;i++){
   const c=text[i];
   if(quoted){
     if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
     else field+=c;
   }else if(c===',')push();
   else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;line();}
   else if(c==='"'&&!field&&!closed)quoted=true;
   else if(closed||c==='"')throw new RangeError('Unexpected character after a quoted CSV value.');
   else field+=c;
 }
 if(quoted)throw new RangeError('A CSV value has an unclosed quote.');
 line();
 if(rows.length<2||rows.length>5001)throw new RangeError('Provide between 1 and 5,000 CSV records.');
 const columns=rows.shift().map(x=>x.trim().toLowerCase().replace(/^\ufeff/,''));
 if(new Set(columns).size!==columns.length||!columns.includes('state'))throw new RangeError('Use unique headers and include a State column.');
 return rows.map((values,i)=>{
   if(values.length!==columns.length)throw new RangeError('Row '+(i+2)+' has '+values.length+' columns. Expected '+columns.length+'.');
   return Object.fromEntries(columns.map((k,j)=>[k,values[j].trim()]));
 });
}
function normalize(raw){
 const data=[],issues=[];
 raw.forEach((r,i)=>{
   const state=r.state.toUpperCase(), division=states.get(state);
   if(!division){issues.push([i+2,'Unknown state code: '+r.state]);return;}
   const entry={State:state,Division:division};
   for(const [key,columns] of Object.entries(attributes)){
     const values=columns.map(c=>c.toLowerCase()).map(c=>r[c]??(c==='sfmnp'?r.sfnmp:undefined)??'').map(v=>v.toUpperCase());
     if(values.some(v=>!known.includes(v)))issues.push([i+2,'Unrecognized Y/N value in '+key]);
     entry[key]=values.includes('Y')?'Y':values.every(v=>v==='N')?'N':'?';
   }
   data.push(entry);
 });
 return {data,issues};
}
function upload(parent,state,redraw){
 const row=element('div',null,parent,'answer'), label=element('label','Upload CSV',row);
 const input=element('input',null,label);input.type='file';input.accept='.csv,text/csv';
 const note=element('p',state.file?'Source · '+state.file:'Source · 306 synthetic market records',parent);
 input.onchange=async()=>{
   try{
     const file=input.files[0];if(!file)return;
     if(file.size>1500000)throw new RangeError('Choose a CSV below 1.5 MB.');
     const text=await file.text();parseCsv(text);
     state.csv=text;state.file=file.name;redraw();
   }catch(error){note.textContent=error.message;}
 };
 element('button','Use synthetic sample',row).onclick=()=>{delete state.csv;delete state.file;redraw();};
 element('a','Download sample CSV',row).href='data:text/csv;charset=utf-8,'+encodeURIComponent(sampleCsv());
 return normalize(parseCsv(state.csv??sampleCsv()));
}
const percent=(n,d)=>d?fmt(100*n/d)+'%':'—';
const select=(key,label,value,options)=>({key,label,value,options,type:'select',live:true});
const slider=(key,label,value,min,max)=>({key,label,value,min,max,step:1,type:'range'});
function records(parent,state,redraw){
 const {data,issues}=upload(parent,state,redraw);
 if(issues.length)element('p',issues.length+' data quality notices. Unknown state codes were excluded, and missing or invalid flags are marked unknown.',parent);
 return data;
}
function counts(data,key,flag){
 const map=new Map();
 for(const record of data){
   const row=map.get(record[key])??[0,0,0];
   row[0]++;row[1]+=Number(record[flag]==='Y');row[2]+=Number(record[flag]==='?');
   map.set(record[key],row);
 }
 return [...map.entries()];
}
function rules(data,minSupport,minConfidence){
 const result=[];
 for(let mask=1;mask<(1<<fields.length);mask++){
   const before=fields.filter((_,i)=>mask&(1<<i));
   for(const target of fields.filter(k=>!before.includes(k))){
     const eligible=data.filter(row=>[...before,target].every(k=>row[k]!=='?'));
     const matched=eligible.filter(row=>before.every(k=>row[k]==='Y'));
     const joint=matched.filter(row=>row[target]==='Y').length;
     const baseline=eligible.filter(row=>row[target]==='Y').length/eligible.length;
     const support=joint/eligible.length, confidence=joint/matched.length;
     if(joint&&support>=minSupport&&confidence>=minConfidence)result.push({before,target,support,confidence,lift:confidence/baseline,n:eligible.length,joint});
   }
 }
 return result.sort((a,b)=>b.lift-a.lift||b.support-a.support);
}
function entropy(positive,n){
 if(!n||positive===0||positive===n)return 0;
 const p=positive/n;return -p*Math.log2(p)-(1-p)*Math.log2(1-p);
}
function partition(data,feature){
 const groups=new Map();
 for(const row of data){const value=row[feature];if(!groups.has(value))groups.set(value,[]);groups.get(value).push(row);}
 return groups;
}
function ranked(data,target,features){
 const base=entropy(data.filter(r=>r[target]==='Y').length,data.length);
 return features.map(feature=>{
   const groups=partition(data,feature);
   const remaining=sum([...groups.values()].map(group=>group.length/data.length*entropy(group.filter(r=>r[target]==='Y').length,group.length)));
   return {feature,groups,gain:Math.max(0,base-remaining)};
 }).sort((a,b)=>b.gain-a.gain);
}
function tree(data,target,features,depth,min){
 const positive=data.filter(r=>r[target]==='Y').length;
 const node={n:data.length,positive,label:positive*2>=data.length?'Y':'N'};
 if(!depth||!features.length||positive===0||positive===data.length||data.length<2*min)return node;
 const winner=ranked(data,target,features).find(x=>x.gain>1e-10&&[...x.groups.values()].every(g=>g.length>=min));
 if(winner){
   node.feature=winner.feature;node.gain=winner.gain;
   node.children=[...winner.groups].sort(([a],[b])=>a.localeCompare(b)).map(([value,group])=>({value,node:tree(group,target,features.filter(k=>k!==winner.feature),depth-1,min)}));
 }
 return node;
}
function treeRows(node,path='All training records'){
 const details=[[path,node.n,percent(node.positive,node.n),node.feature?node.feature+' · '+fmt(node.gain)+' bits':node.label]];
 return details.concat(node.children?.flatMap(({value,node:next})=>treeRows(next,path+' / '+node.feature+' = '+value))??[]);
}
function check(ok,label){if(!ok)throw Error(label);}
export const app={
  title:'Market Weight Lab',description:'Compare geographic concentration with offering composition using two distinct denominators.',
  controls:[select('division','Division','South Atlantic',Object.keys(divisions))],
  method:'Here T-weight means the division’s share of nationwide confirmed positives for an offering. D-weight means that offering’s share of all confirmed offering flags within the division. A market can contribute multiple flags. Prevalence is the percentage of markets with known status that offer the item.',
  check(){check(percent(2,8)==='25%'&&percent(1,0)==='—','Weight denominators');},
  render(p,{division},state,redraw){
   const data=records(p,state,redraw), selected=data.filter(r=>r.Division===division);
   const rows=fields.map(k=>[k,selected.filter(r=>r[k]==='Y').length,data.filter(r=>r[k]==='Y').length,selected.filter(r=>r[k]!=='?').length]);
   const total=sum(rows.map(r=>r[1]));
   badge(p,division+' · '+selected.length+' records · '+total+' confirmed offering flags');
   table(p,['Offering','Division positives','Nationwide positives','T-weight','D-weight','Prevalence'],rows.map(([k,a,b,known])=>[k,a,b,percent(a,b),percent(a,total),percent(a,known)]));
  }
 };
