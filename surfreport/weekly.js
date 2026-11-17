// First-stage seven-day component explorer. Missing partitions remain missing.
const components=[['wave','Combined sea','#d9c4f5','period','direction'],['swell','Swell','#a879e8','swellPeriod','swellDirection'],['secondary','Secondary swell','#e8bd78','secondaryPeriod','secondaryDirection'],['tertiary','Tertiary swell','#e190b9','tertiaryPeriod','tertiaryDirection'],['windWave','Wind waves','#83cbd5','windWavePeriod','windWaveDirection']];
let mode='height',enabled=new Set(['wave','swell','secondary','tertiary','windWave']),selected=-1;
let graphWidth = 1000;
const ns='http://www.w3.org/2000/svg';
function svg(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;return e;}
const val=(v,suffix)=>Number.isFinite(v)?v.toFixed(1)+suffix:'—';
const bearing=d=>Number.isFinite(d)?['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(((d%360)+360)%360/22.5)%16]:'—';
const periodRadius = seconds => 2.8 + Math.max(0, Math.min(12, seconds - 5)) * .35;

function periodKey() {
 const key = document.createElement('div');
 key.className = 'week-period-key';
 const title = document.createElement('strong');
 title.textContent = 'Circle size shows period';
 key.append(title);
 for (const [period, text] of [[5, '≤5 s'], [11, '11 s'], [17, '≥17 s']]) {
  const item = document.createElement('span');
  const icon = svg('svg', {width:20,height:20,viewBox:'0 0 20 20','aria-hidden':'true'});
  icon.append(svg('circle', {cx:10,cy:10,r:periodRadius(period),fill:'none',stroke:'currentColor','stroke-width':1.6}));
  item.append(icon, text);
  key.append(item);
 }
 return key;
}

export function weekly(rows,{zone,units}){
 const root = document.getElementById('weekly');
 root.replaceChildren();if(!rows.length){root.textContent='Load a forecast to explore the week.';return;}
 if (root.clientWidth) graphWidth = Math.max(260, root.clientWidth);
 const compact = graphWidth < 520;
 const plotLeft = compact ? 42 : 65;
 const plotRight = graphWidth - (compact ? 8 : 20);
 const plotWidth = plotRight - plotLeft;
 const axisFont = compact ? 10 : 13;
 const fmt=(t,opt)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,...opt}).format(new Date(t*1000));
 const scale=units==='imperial'?3.28084:1,heightUnit=units==='imperial'?' ft':' m',unit=mode==='height'?heightUnit:' s';
 const heading=document.createElement('h3');heading.textContent='Seven-day swell explorer';const toolbar=document.createElement('div');toolbar.className='week-toolbar';toolbar.append(heading);root.append(toolbar);
 const controls=document.createElement('div');controls.className='week-controls';
 const label=document.createElement('label');label.htmlFor='week-mode';label.textContent='Graph';const select=document.createElement('select');select.id='week-mode';for(const [v,t]of [['height','Wave / swell height'],['period','Wave / swell period']]){const o=document.createElement('option');o.value=v;o.textContent=t;select.append(o);}select.value=mode;select.onchange=()=>{mode=select.value;weekly(rows,{zone,units});};controls.append(label,select);toolbar.append(controls);
 const legend=document.createElement('div');legend.className='week-legend';root.append(legend);
 const series=components.map(([key,name,color,period,direction])=>({key,name,color,period,direction,values:rows.map(r=>mode==='height'?(Number.isFinite(r[key])?r[key]*scale:null):r[period]),available:rows.some(r=>Number.isFinite(mode==='height'?r[key]:r[period]))}));
 for(const s of series){const l=document.createElement('label'),check=document.createElement('input'),swatch=document.createElement('i');check.type='checkbox';check.checked=enabled.has(s.key)&&s.available;check.disabled=!s.available;check.setAttribute('aria-label',s.name);check.onchange=()=>{check.checked?enabled.add(s.key):enabled.delete(s.key);weekly(rows,{zone,units});};swatch.style.background=s.color;l.append(check,swatch,document.createTextNode(s.name+(s.available?'':' · unavailable')));legend.append(l);}
 const graph=svg('svg',{viewBox:'0 0 '+graphWidth+' 310',role:'img','aria-label':`Seven-day ${mode} forecast in ${unit.trim()}, in location time. Use the hourly slider and data table for exact values.`,class:'week-chart'});
 const shown=series.filter(s=>s.available&&enabled.has(s.key));const max=Math.max(mode==='height'?1:5,...shown.flatMap(s=>s.values.filter(Number.isFinite)))*1.12;
 for(let i=0;i<5;i++){const y=260-i*55;graph.append(svg('line',{x1:plotLeft,y1:y,x2:plotRight,y2:y,stroke:'#44394f'}),svg('text',{x:6,y:y+4,fill:'#b5a9c2','font-size':axisFont},(max*i/4).toFixed(1)+unit));}
 const start=rows[0].time,end=rows.at(-1).time,span=end-start||1,x=t=>plotLeft+(t-start)/span*plotWidth;
 const days=new Map();rows.forEach(r=>{const d=fmt(r.time,{year:'numeric',month:'2-digit',day:'2-digit'});if(!days.has(d))days.set(d,[]);days.get(d).push(r);});
 [...days.values()].forEach(day=>{const xx=x(day[0].time);const label=fmt(day[0].time,{weekday:compact?'narrow':'short',day:'numeric'});graph.append(svg('line',{x1:xx,y1:20,x2:xx,y2:260,stroke:'#44394f','stroke-dasharray':'3 5'}),svg('text',{x:Math.min(xx+3,graphWidth-(compact?25:48)),y:289,fill:'#b5a9c2','font-size':axisFont},label));});
 const markers = svg('g', {class:'week-period-dots',fill:'none','aria-hidden':'true'});
 const markerStep = compact ? 24 : 12;
 for (const s of shown) {
  let path = '', active = false;
  s.values.forEach((value, i) => {
   if (!Number.isFinite(value)) { active = false; return; }
   const row = rows[i], xx = x(row.time), yy = 260-value/max*220;
   path += (active ? 'L' : 'M') + xx.toFixed(2) + ',' + yy.toFixed(2) + ' ';
   active = true;
   const period = row[s.period];
   if (mode === 'height' && i % markerStep === 0 && Number.isFinite(period) && period > 0) {
    markers.append(svg('circle', {cx:xx,cy:yy,r:periodRadius(period),stroke:s.color,'stroke-width':1.6}));
   }
  });
  graph.append(svg('path',{d:path,fill:'none',stroke:s.color,'stroke-width':s.key==='wave'?3:2,'stroke-linejoin':'round'}));
 }
 if (markers.childElementCount) {
  graph.append(markers);
  root.append(periodKey());
 }
 if(selected<0||selected>=rows.length)selected=Math.max(0,rows.findIndex(r=>r.time>=Date.now()/1000));
 const cursor=svg('line',{x1:x(rows[selected].time),y1:20,x2:x(rows[selected].time),y2:260,stroke:'#f0eaf6','stroke-dasharray':'4 4'});graph.append(cursor);
 const hoverCursor = svg('line', {y1:20, y2:260, stroke:'#d7b9f5', 'stroke-width':1, visibility:'hidden'});
 graph.append(hoverCursor);
 const plot = document.createElement('div');
 plot.className = 'week-plot';
 const tooltip = document.createElement('div');
 tooltip.className = 'week-tooltip';
 tooltip.hidden = true;
 tooltip.setAttribute('aria-hidden', 'true');
 plot.append(graph, tooltip);
 root.append(plot);
 const sliderLabel=document.createElement('label');sliderLabel.htmlFor='week-hour';sliderLabel.textContent='Inspect forecast hour · local time';const slider=document.createElement('input');slider.type='range';slider.id='week-hour';slider.min=0;slider.max=rows.length-1;slider.step=1;slider.value=selected;root.append(sliderLabel,slider);
 const readout=document.createElement('div');readout.className='week-readout';readout.setAttribute('aria-live','polite');root.append(readout);
 function renderReadings(panel, row, items) {
  const heading = document.createElement('strong');
  heading.textContent = fmt(row.time,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  panel.replaceChildren(heading);
  for (const item of items) {
   const line = document.createElement('span');
   line.className = 'week-reading';
   line.style.setProperty('--series-color', item.color);
   const label = document.createElement('span');
   label.className = 'week-reading-label';
   label.textContent = item.name + ':';
   const value = document.createElement('span');
   value.textContent = val(Number.isFinite(row[item.key]) ? row[item.key]*scale : null,heightUnit) +
     ' · ' + val(row[item.period],' s') + ' · from ' + bearing(row[item.direction]);
   line.append(label, value);
   panel.append(line);
  }
 }
 function inspect(i) {
  selected = Math.max(0, Math.min(rows.length-1, i));
  slider.value = selected;
  const row = rows[selected];
  cursor.setAttribute('x1', x(row.time));
  cursor.setAttribute('x2', x(row.time));
  renderReadings(readout, row, series);
 }
 function hourAt(clientX) {
  const bounds = graph.getBoundingClientRect();
  const fraction = ((clientX-bounds.left)/bounds.width*graphWidth-plotLeft)/plotWidth;
  const instant = start + span*fraction;
  const next = rows.findIndex(row => row.time >= instant);
  if (next === -1) return rows.length-1;
  return next > 0 && instant-rows[next-1].time <= rows[next].time-instant ? next-1 : next;
 }
 let hovered = -1;
 graph.onpointermove = event => {
  if (event.pointerType === 'touch') return;
  const index = hourAt(event.clientX);
  const row = rows[index];
  if (hovered !== index) {
   hovered = index;
   renderReadings(tooltip, row, shown);
   hoverCursor.setAttribute('x1', x(row.time));
   hoverCursor.setAttribute('x2', x(row.time));
   hoverCursor.setAttribute('visibility', 'visible');
  }
  tooltip.hidden = false;
  const bounds = plot.getBoundingClientRect();
  const px = event.clientX-bounds.left, py = event.clientY-bounds.top;
  const left = px+14+tooltip.offsetWidth <= bounds.width ? px+14 : px-14-tooltip.offsetWidth;
  const top = py+14+tooltip.offsetHeight <= bounds.height ? py+14 : py-14-tooltip.offsetHeight;
  tooltip.style.left = Math.max(6, Math.min(left, bounds.width-tooltip.offsetWidth-6)) + 'px';
  tooltip.style.top = Math.max(6, Math.min(top, bounds.height-tooltip.offsetHeight-6)) + 'px';
 };
 graph.onpointerleave = graph.onpointercancel = () => {
  hovered = -1;
  tooltip.hidden = true;
  hoverCursor.setAttribute('visibility', 'hidden');
 };
 graph.onpointerdown = event => inspect(hourAt(event.clientX));
 slider.oninput = () => inspect(Number(slider.value));
 inspect(selected);
 const note=document.createElement('p');note.className='small';note.textContent='Combined sea includes wind waves and swell; heights are not added arithmetically. Missing data creates gaps. Swell partitions are model components, not tracked named storms, and may change order over time. Secondary/tertiary availability depends on the provider model. Tap the chart or use the hourly slider.';root.append(note);
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Daily maximum heights · accessible data table';details.append(summary);
 const wrap=document.createElement('div');wrap.className='week-table';const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');for(const text of ['Date',...components.map(c=>c[1]+heightUnit)]){const th=document.createElement('th');th.scope='col';th.textContent=text;tr.append(th);}thead.append(tr);table.append(thead);const tbody=document.createElement('tbody');for(const day of days.values()){const tr=document.createElement('tr');for(const text of [fmt(day[0].time,{weekday:'short',month:'short',day:'numeric'}),...components.map(([k])=>{const data=day.map(r=>r[k]).filter(Number.isFinite);return data.length?val(Math.max(...data)*scale,''):'—';})]){const td=document.createElement('td');td.textContent=text;tr.append(td);}tbody.append(tr);}table.append(tbody);wrap.append(table);details.append(wrap);root.append(details);
}
