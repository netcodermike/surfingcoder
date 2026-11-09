export const patterns={trend:'Trend + pullbacks',range:'Sideways market',squeeze:'Volatility squeeze',shock:'Sudden price shock',reversal:'Trend reversal',flat:'Flat price'};
export function synthetic(pattern='squeeze',length=240,seed=42017){
 if(!(pattern in patterns))throw Error('Unknown synthetic pattern.');
 if(!Number.isInteger(length)||length<10||length>2000)throw Error('Use 10–2,000 synthetic bars.');
 let state=seed>>>0,price=100;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
 return Array.from({length},(_,i)=>{
  const t=i/length,noise=(random()-.5)*2;
  if(pattern==='trend')price=100+i*.14+Math.sin(i/9)*3+noise*.8;
  if(pattern==='range')price=105+Math.sin(i/8)*5+Math.sin(i/3)*1.3+noise*.6;
  if(pattern==='squeeze'){const amp=t<.36?4:t<.65?.45:2.3;price=104+Math.sin(i/6)*amp+noise*amp*.4+Math.max(0,i-length*.65)*.27;}
  if(pattern==='shock')price=100+i*.035+(t>.52?16*Math.exp(-(t-.52)*3):0)+Math.sin(i/7)*1.2+noise*.5;
  if(pattern==='reversal')price=100+Math.min(i,length*.5)*.22-Math.max(0,i-length*.5)*.26+Math.sin(i/8)*2+noise*.5;
  if(pattern==='flat')price=100;
  const date=new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10);return {date,close:Math.round(price*10000)/10000};
 });
}
function fields(line){
 const out=[];let part='',quoted=false;
 for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){part+='"';i++;}else if(quoted||part.trim()===''){quoted=!quoted;}else throw Error('Unexpected quote in CSV.');}else if(c===','&&!quoted){out.push(part.trim());part='';}else part+=c;}
 if(quoted)throw Error('Unclosed CSV quote; multiline fields are not supported.');out.push(part.trim());return out;
}
export function parseCSV(text){
 if(typeof text!=='string'||text.length>1000000)throw Error('CSV limit is 1 MB.');
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).filter(l=>l.trim());if(lines.length<11||lines.length>2001)throw Error('CSV needs a header and 10–2,000 data rows.');
 const header=fields(lines[0]).map(v=>v.toLowerCase()),dateIndex=header.indexOf('date'),closeIndex=header.indexOf('close');
 if(dateIndex<0||closeIndex<0||new Set(header).size!==header.length)throw Error('Use unique column headers including date and close.');
 let previous=-Infinity;
 return lines.slice(1).map((line,i)=>{const cols=fields(line);if(cols.length!==header.length)throw Error(`CSV row ${i+2} has the wrong number of columns.`);
  const date=cols[dateIndex];if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error(`CSV row ${i+2}: date must be YYYY-MM-DD.`);
  const stamp=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==date||stamp<=previous)throw Error(`CSV row ${i+2}: dates must be valid, unique, and ascending.`);previous=stamp;
  const raw=cols[closeIndex],close=Number(raw);if(raw===''||!Number.isFinite(close)||close<=0||close>1e9)throw Error(`CSV row ${i+2}: close must be positive and at most one billion.`);
  return {date,close};
 });
}
export function exportCSV(rows,calc){
 const head=['date','close','sma','ema','bb_middle','bb_upper','bb_lower','bb_population_sd','bb_width_percent','bb_percent_b','rsi','macd','macd_signal','macd_histogram'];
 const clean=v=>Number.isFinite(v)?String(v):'';
 return head.join(',')+'\n'+rows.map((r,i)=>[r.date,r.close,calc.sma[i],calc.ema[i],calc.bands.middle[i],calc.bands.upper[i],calc.bands.lower[i],calc.bands.sd[i],calc.bands.bandwidth[i],calc.bands.percentB[i],calc.rsi[i],calc.macd.line[i],calc.macd.signal[i],calc.macd.histogram[i]].map(v=>typeof v==='string'?v:clean(v)).join(',')).join('\n');
}
