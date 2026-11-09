import {defaults,validateSettings,indicators} from './src/indicators.js';
import {patterns,synthetic,parseCSV,exportCSV} from './src/data.js';
const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,digits=2)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits}):'—';
const colors={price:'#eee7f6',sma:'#eac274',ema:'#74cfca',bands:'#ac7de9',rsi:'#c7a2f4',macd:'#79d1cb',signal:'#e8bd76',positive:'#678f9b',negative:'#a76391'};
let rows=synthetic(),settings={...defaults},revealed=rows.length,selected=rows.length-1,calc,oscillator='rsi',timer=null,source='Synthetic · Volatility squeeze',windowStart=0,priceScale,momentumScale,loadSequence=0;
function error(e){$('error').hidden=false;$('error').textContent=e.message??String(e);}
function clearError(){$('error').hidden=true;$('error').textContent='';}
function stop(){if(timer)clearInterval(timer);timer=null;$('play').textContent='Play';}
function dataChanged(){stop();revealed=rows.length;selected=rows.length-1;clearError();render();}
function metric(label,value,note){return `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`;}
function frame(low,high,height=350){
 if(low===high){low-=Math.max(1,Math.abs(low)*.01);high+=Math.max(1,Math.abs(high)*.01);}const pad=(high-low)*.08;low-=pad;high+=pad;
 const top=20,bottom=height-43,left=62,right=980;
 return {height,low,high,top,bottom,x:i=>left+(i-windowStart)/Math.max(1,revealed-windowStart-1)*(right-left),y:v=>bottom-(v-low)/(high-low)*(bottom-top)};
}
function grid(scale,{fixed=false}={}){
 let s='';for(let i=0;i<5;i++){const v=scale.low+(scale.high-scale.low)*i/4,y=scale.y(v),label=Math.abs(v)>=1000?v.toLocaleString('en-US',{notation:'compact',maximumFractionDigits:1}):fmt(v,scale.high-scale.low>10?0:1);s+=`<line x1="62" y1="${y}" x2="980" y2="${y}" stroke="#44394f"/><text x="5" y="${y+4}" fill="#b5a9c2" font-size="12">${label}</text>`;}
 const count=revealed-windowStart;for(let j=0;j<6;j++){const i=windowStart+Math.round((count-1)*j/5);s+=`<text x="${Math.min(scale.x(i),930)}" y="${scale.height-12}" fill="#b5a9c2" font-size="12">${esc(rows[i].date.slice(5))}</text>`;}
 return s;
}
function path(values,scale){let d='',active=false;for(let i=windowStart;i<revealed;i++){const v=values[i];if(!Number.isFinite(v)){active=false;continue;}d+=`${active?'L':'M'}${scale.x(i).toFixed(2)},${scale.y(v).toFixed(2)} `;active=true;}return d;}
function line(values,color,scale,width=2){return `<path d="${path(values,scale)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;}
function cursor(scale){return `<line data-cursor x1="${scale.x(selected)}" x2="${scale.x(selected)}" y1="${scale.top}" y2="${scale.bottom}" stroke="#d9c4f5" stroke-dasharray="4 5" opacity=".65"/>`;}
function renderPrice(){
 const values=rows.slice(windowStart,revealed).map(r=>r.close);
 if($('show-sma').checked)values.push(...calc.sma.slice(windowStart).filter(Number.isFinite));
 if($('show-ema').checked)values.push(...calc.ema.slice(windowStart).filter(Number.isFinite));
 if($('show-bands').checked)values.push(...calc.bands.upper.slice(windowStart).filter(Number.isFinite),...calc.bands.lower.slice(windowStart).filter(Number.isFinite));
 const scale=priceScale=frame(Math.min(...values),Math.max(...values)),close=rows.slice(0,revealed).map(r=>r.close);let svg=grid(scale);
 if($('show-bands').checked){const indices=Array.from({length:revealed-windowStart},(_,j)=>j+windowStart).filter(i=>Number.isFinite(calc.bands.upper[i]));if(indices.length){const points=[...indices.map(i=>`${scale.x(i)},${scale.y(calc.bands.upper[i])}`),...indices.toReversed().map(i=>`${scale.x(i)},${scale.y(calc.bands.lower[i])}`)];svg+=`<polygon points="${points.join(' ')}" fill="#a879e8" opacity=".13"/>`;}
  svg+=line(calc.bands.upper,colors.bands,scale,1.4)+line(calc.bands.lower,colors.bands,scale,1.4)+`<path d="${path(calc.bands.middle,scale)}" fill="none" stroke="${colors.bands}" stroke-width="1" stroke-dasharray="4 5"/>`;
 }
 if($('show-sma').checked)svg+=line(calc.sma,colors.sma,scale,2.2);if($('show-ema').checked)svg+=line(calc.ema,colors.ema,scale,2.2);svg+=line(close,colors.price,scale,2.4)+cursor(scale)+`<circle id="price-point" cx="${scale.x(selected)}" cy="${scale.y(rows[selected].close)}" r="4" fill="${colors.price}" stroke="#18161e" stroke-width="2"/>`;
 $('price-chart').innerHTML=`<svg viewBox="0 0 1000 ${scale.height}" role="img" aria-label="Closing price with selected indicators. ${esc(rows[windowStart].date)} through ${esc(rows[revealed-1].date)}. Use the inspect slider and data table for exact values.">${svg}</svg>`;
 bindChart($('price-chart'));
}
function renderMomentum(){
 let scale,svg;
 if(oscillator==='rsi'){
  scale=momentumScale={...frame(0,100,210),low:0,high:100};scale.y=v=>scale.bottom-v/100*(scale.bottom-scale.top);svg=grid(scale);
  for(const v of [30,70])svg+=`<line x1="62" x2="980" y1="${scale.y(v)}" y2="${scale.y(v)}" stroke="#ac7de9" stroke-dasharray="5 5"/><text x="946" y="${scale.y(v)-4}" font-size="11" fill="#c7a2f4">${v}</text>`;
  svg+=line(calc.rsi,colors.rsi,scale,2.5);$('momentum-note').textContent=`Wilder RSI (${settings.rsi}) · 0–100 scale. The 30/70 guides are descriptive thresholds, not automatic trade signals.`;
 }else{
  const vals=[0,...calc.macd.line.slice(windowStart).filter(Number.isFinite),...calc.macd.signal.slice(windowStart).filter(Number.isFinite),...calc.macd.histogram.slice(windowStart).filter(Number.isFinite)];
  scale=momentumScale=frame(Math.min(...vals),Math.max(...vals),210);svg=grid(scale);svg+=`<line x1="62" x2="980" y1="${scale.y(0)}" y2="${scale.y(0)}" stroke="#79618e"/>`;
  const width=Math.max(1,Math.min(9,800/Math.max(1,revealed-windowStart)));for(let i=windowStart;i<revealed;i++){const v=calc.macd.histogram[i];if(Number.isFinite(v))svg+=`<rect x="${scale.x(i)-width/2}" y="${Math.min(scale.y(0),scale.y(v))}" width="${width}" height="${Math.max(.4,Math.abs(scale.y(v)-scale.y(0)))}" fill="${v>=0?colors.positive:colors.negative}" opacity=".8"/>`;}
  svg+=line(calc.macd.line,colors.macd,scale,2.5)+line(calc.macd.signal,colors.signal,scale,2);$('momentum-note').textContent=`MACD (${settings.fast}, ${settings.slow}, ${settings.signal}) · cyan: fast EMA − slow EMA; gold: signal EMA; bars: their difference. Values use the input price units.`;
 }
 svg+=cursor(scale);$('momentum-chart').innerHTML=`<svg viewBox="0 0 1000 ${scale.height}" role="img" aria-label="${oscillator==='rsi'?'RSI momentum, 0 to 100':'MACD line, signal, and histogram'} for the same revealed price history.">${svg}</svg>`;bindChart($('momentum-chart'));
 $('rsi-view').setAttribute('aria-pressed',String(oscillator==='rsi'));$('macd-view').setAttribute('aria-pressed',String(oscillator==='macd'));
}
function bindChart(root){root.querySelector('svg').onpointerdown=e=>{const bounds=e.currentTarget.getBoundingClientRect(),px=(e.clientX-bounds.left)/bounds.width*1000;selected=Math.max(windowStart,Math.min(revealed-1,windowStart+Math.round((px-62)/918*Math.max(1,revealed-windowStart-1))));inspect();};}
function inspect(){
 $('inspect-bar').value=selected;$('inspect-date').textContent=`${rows[selected].date} · bar ${selected+1}`;
 const b=calc.bands;$('metrics').innerHTML=metric('Inspected close',fmt(rows[selected].close),rows[selected].date)+metric(`RSI (${settings.rsi})`,fmt(calc.rsi[selected],1),calc.rsi[selected]===null?'Warming up':'Wilder smoothing')+metric('Band width',b.bandwidth[selected]===null?'—':fmt(b.bandwidth[selected],1)+'%',`${settings.bands}-bar window · ${settings.k}σ`);
 for(const [root,scale]of [[$('price-chart'),priceScale],[$('momentum-chart'),momentumScale]]){const c=root.querySelector('[data-cursor]');if(c){c.setAttribute('x1',scale.x(selected));c.setAttribute('x2',scale.x(selected));}}
 const point=$('price-point');if(point){point.setAttribute('cx',priceScale.x(selected));point.setAttribute('cy',priceScale.y(rows[selected].close));}lesson();
}
function lesson(){
 const i=selected,p=rows[i].close,s=settings,b=calc.bands,warm=n=>`This reading needs ${n} bars. At this inspected bar, only ${i+1} have occurred.`,date=esc(rows[i].date);let html='';
 switch($('lesson').value){
 case 'sma':html=`<h3>Equal weight. A smoother view.</h3><p>The simple moving average averages the last ${s.sma} closes. Each close has the same weight; older bars drop out as new ones arrive.</p><div class="formula">SMA = sum(last n closes) / n\nn = ${s.sma}\nEach weight = ${fmt(100/s.sma,2)}%</div><p class="formula-value"><strong>${date}: ${fmt(calc.sma[i])}</strong><br>${calc.sma[i]===null?warm(s.sma):`The last ${s.sma} closes sum to ${fmt(calc.sma[i]*s.sma)}.`}</p><p>Longer windows smooth more noise but respond more slowly to a change. A moving average describes past prices and lags them.</p>`;break;
 case 'ema':{const alpha=2/(s.ema+1);html=`<h3>Give the newest price more influence.</h3><p>The exponential moving average blends today's close with yesterday's EMA. Its older observations fade gradually instead of falling out at a fixed window boundary.</p><div class="formula">α = 2 / (n + 1) = ${fmt(alpha,4)}\nEMAₜ = α × closeₜ\n     + (1 − α) × EMAₜ₋₁\nn = ${s.ema}</div><p class="formula-value"><strong>${date}: ${fmt(calc.ema[i])}</strong><br>${calc.ema[i]===null?warm(s.ema):i===s.ema-1?'First EMA: seeded with the first full-window SMA.':`${fmt(alpha,4)} × ${fmt(p)} + ${fmt(1-alpha,4)} × ${fmt(calc.ema[i-1])}`}</p><p>This app seeds the EMA with an SMA of the first ${s.ema} closes. Platforms with different seeds or more history can differ near the beginning.</p>`;break;}
 case 'bands':html=`<h3>A moving center, a changing envelope.</h3><p>Bollinger Bands place an envelope around a moving average. The envelope expands when recent prices are more dispersed and contracts when they cluster.</p><div class="formula">Middle = SMA(${s.bands})\nσ = sqrt(Σ(close − mean)² / n)\nUpper = Middle + ${s.k} × σ\nLower = Middle − ${s.k} × σ</div><p class="formula-value"><strong>${date}</strong><br>Middle ${fmt(b.middle[i])}<br>Population σ ${fmt(b.sd[i],4)}<br>Upper ${fmt(b.upper[i])} · Lower ${fmt(b.lower[i])}<br>%B ${fmt(b.percentB[i],3)}</p><p>${b.middle[i]===null?warm(s.bands):b.sd[i]===0?'A flat window has zero width, so %B is undefined.':`Close ${fmt(p)} is ${fmt(b.percentB[i]*100,1)}% of the distance from the lower to the upper band. Values can fall below 0% or above 100%.`}</p><p>A squeeze describes low recent dispersion; it does not determine the next move's direction. Two-sigma bands are not a guarantee that 95% of future prices stay inside.</p>`;break;
 case 'rsi':html=`<h3>Compare smoothed gains and losses.</h3><p>Relative strength index summarizes the balance of recent upward and downward closing-price changes. This version uses Wilder's smoothing.</p><div class="formula">RS = average gain / average loss\nRSI = 100 − 100 / (1 + RS)\navgₜ = ((n − 1) × avgₜ₋₁\n       + changeₜ) / n\nn = ${s.rsi}</div><p class="formula-value"><strong>${date}: ${fmt(calc.rsi[i],2)}</strong><br>${calc.rsi[i]===null?warm(s.rsi+1):'Range: 0 to 100. Initial averages use the first full window of price changes.'}</p><p>Guides at 30 and 70 highlight low and high readings. Strong trends can remain beyond those guides. Flat gains and losses return 50 here; gains with no losses return 100.</p>`;break;
 case 'macd':html=`<h3>Momentum as the gap between averages.</h3><p>MACD compares a faster EMA with a slower one. The signal line smooths that difference; the histogram shows the gap between the two lines.</p><div class="formula">MACD = EMA(${s.fast}) − EMA(${s.slow})\nSignal = EMA(${s.signal}) of MACD\nHistogram = MACD − Signal</div><p class="formula-value"><strong>${date}</strong><br>MACD ${fmt(calc.macd.line[i],3)}<br>Signal ${fmt(calc.macd.signal[i],3)}<br>Histogram ${fmt(calc.macd.histogram[i],3)}</p><p>The MACD line first appears at bar ${s.slow}; the signal and histogram at bar ${s.slow+s.signal-1}. Crossovers can whipsaw in sideways markets; a histogram near zero means the lines are close, not that future risk is low.</p>`;break;
 }
 $('lesson-content').innerHTML=html;
}
function renderTable(){const first=Math.max(0,revealed-100);$('table').innerHTML=`<table><thead><tr>${['Date','Close','SMA','EMA','BB upper','BB lower','RSI','MACD','Signal'].map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${rows.slice(first,revealed).map((r,j)=>{const i=first+j;return `<tr><td>${esc(r.date)}</td>${[r.close,calc.sma[i],calc.ema[i],calc.bands.upper[i],calc.bands.lower[i],calc.rsi[i],calc.macd.line[i],calc.macd.signal[i]].map(v=>`<td>${fmt(v)}</td>`).join('')}</tr>`;}).join('')}</tbody></table>`;}
function render(){
 calc=indicators(rows.slice(0,revealed).map(r=>r.close),settings);const window=$('window').value==='all'?revealed:+$('window').value;windowStart=Math.max(0,revealed-window);selected=Math.min(revealed-1,Math.max(windowStart,selected));
 $('reveal').max=rows.length;$('reveal').value=revealed;$('reveal-count').textContent=`${revealed} / ${rows.length}`;
 $('inspect-bar').min=windowStart;$('inspect-bar').max=revealed-1;$('inspect-bar').value=selected;$('next').disabled=revealed===rows.length;
 $('source-label').textContent=source.toUpperCase();$('status').textContent=`${revealed} bars revealed · ${rows[0].date} to ${rows[revealed-1].date} · closing prices`;
 $('data-note').textContent=source.startsWith('Synthetic')?'Generated example prices, not a real security. One bar represents one calendar day.':`Imported locally: ${source.slice(6)}. No currency or split adjustment is inferred.`;
 renderPrice();renderMomentum();inspect();renderTable();
}
function download(name,text,type='text/csv'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('settings-form').onsubmit=e=>{e.preventDefault();try{const next={};for(const key of Object.keys(defaults))next[key]=Number($(key).value);const valid=validateSettings(next);settings=valid;clearError();render();}catch(e){error(e);}};
$('reset').onclick=()=>{stop();settings={...defaults};for(const k of Object.keys(defaults))$(k).value=defaults[k];clearError();render();};
$('dataset').onchange=()=>{loadSequence++;rows=synthetic($('dataset').value);source='Synthetic · '+patterns[$('dataset').value];$('csv-file').value='';dataChanged();};
for(const id of ['show-sma','show-ema','show-bands','window'])$(id).onchange=()=>render();
$('lesson').onchange=lesson;$('inspect-bar').oninput=e=>{selected=+e.target.value;inspect();};
$('rsi-view').onclick=()=>{oscillator='rsi';renderMomentum();};$('macd-view').onclick=()=>{oscillator='macd';renderMomentum();};
$('reveal').oninput=e=>{stop();revealed=+e.target.value;selected=revealed-1;render();};
$('next').onclick=()=>{stop();if(revealed<rows.length){revealed++;selected=revealed-1;render();}};
$('all').onclick=()=>{stop();revealed=rows.length;selected=revealed-1;render();};
$('play').onclick=()=>{if(timer){stop();return;}if(revealed===rows.length){revealed=Math.min(30,rows.length);selected=revealed-1;render();}$('play').textContent='Pause';timer=setInterval(()=>{if(revealed>=rows.length){stop();return;}revealed++;selected=revealed-1;render();},350);};
$('csv-file').onchange=async e=>{const file=e.target.files[0],request=++loadSequence;if(!file)return;stop();try{if(file.size>1000000)throw Error('CSV file limit is 1 MB.');const parsed=parseCSV(await file.text());if(request!==loadSequence)return;rows=parsed;source='CSV · '+file.name;dataChanged();}catch(e){if(request===loadSequence)error(e);}};
$('sample').onclick=()=>{const sample=synthetic('trend',120);download('sample-price-history.csv','date,close\n'+sample.map(r=>`${r.date},${r.close}`).join('\n'));};
$('export').onclick=()=>download('indicator-history.csv',exportCSV(rows.slice(0,revealed),calc));
window.addEventListener('pagehide',stop);render();
