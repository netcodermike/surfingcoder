import { tideColor, tidePanel, windColor, windPanel } from './forecast-panels.js?v=20261117-daylight';
import { compass } from './src/core.js?v=20261117-tides-wind';

const components=[['wave','Combined sea','#d9c4f5','period','direction'],['swell','Swell','#a879e8','swellPeriod','swellDirection'],['secondary','Secondary swell','#e8bd78','secondaryPeriod','secondaryDirection'],['tertiary','Tertiary swell','#e190b9','tertiaryPeriod','tertiaryDirection'],['windWave','Wind waves','#83cbd5','windWavePeriod','windWaveDirection']];
let mode='height',enabled=new Set(['wave','swell','secondary','tertiary','windWave']),selected=-1;
let graphWidth = 1000;
let periodSeriesKey = 'wave';
const ns='http://www.w3.org/2000/svg';
function svg(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;return e;}
const val=(v,suffix)=>Number.isFinite(v)?v.toFixed(1)+suffix:'—';
const bearing=d=>Number.isFinite(d)?compass(d):'—';
const hasPeriod = value => Number.isFinite(value) && value > 0;

export function weekly(rows,options){
 const {zone,units,tide,daylight}=options;
 const root = document.getElementById('weekly');
 const active = document.activeElement;
 const focusId = root.contains(active) ? active.id : '';
 root.replaceChildren();if(!rows.length){root.textContent='Load a forecast to explore the week.';return;}
 if (root.clientWidth) graphWidth = Math.max(260, root.clientWidth);
 const compact = graphWidth < 520;
 const plotLeft = compact ? 49 : 65;
 const axisFont = compact ? 10 : 13;
 const fmt=(t,opt)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,...opt}).format(new Date(t*1000));
 const imperial = units === 'imperial';
 const scale=imperial?3.28084:1,heightUnit=imperial?' ft':' m',unit=mode==='height'?heightUnit:' s';
 const speedScale = imperial ? .621371 : 1, speedUnit = imperial ? ' mph' : ' km/h';
 const heading=document.createElement('h3');heading.textContent='Seven-day swell explorer';const toolbar=document.createElement('div');toolbar.className='week-toolbar';toolbar.append(heading);root.append(toolbar);
 const controls=document.createElement('div');controls.className='week-controls';
 const label=document.createElement('label');label.htmlFor='week-mode';label.textContent='Graph';const select=document.createElement('select');select.id='week-mode';for(const [v,t]of [['height','Wave / swell height'],['period','Wave / swell period']]){const o=document.createElement('option');o.value=v;o.textContent=t;select.append(o);}select.value=mode;select.onchange=()=>{mode=select.value;weekly(rows,options);};controls.append(label,select);toolbar.append(controls);
 const legend=document.createElement('div');legend.className='week-legend';root.append(legend);
 const series=components.map(([key,name,color,period,direction])=>({key,name,color,period,direction,values:rows.map(r=>mode==='height'?(Number.isFinite(r[key])?r[key]*scale:null):r[period]),available:rows.some(r=>Number.isFinite(mode==='height'?r[key]:r[period]))}));
 for(const s of series){const l=document.createElement('label'),check=document.createElement('input'),swatch=document.createElement('i');check.type='checkbox';check.id='week-show-'+s.key;check.checked=enabled.has(s.key)&&s.available;check.disabled=!s.available;check.setAttribute('aria-label',s.name);check.onchange=()=>{check.checked?enabled.add(s.key):enabled.delete(s.key);weekly(rows,options);};swatch.style.background=s.color;l.append(check,swatch,document.createTextNode(s.name+(s.available?'':' · unavailable')));legend.append(l);}
 const shown = series.filter(s => s.available && enabled.has(s.key));
 const periodOptions = mode === 'height' ? shown.filter(s => rows.some(row => hasPeriod(row[s.period]))) : [];
 const periodSeries = periodOptions.find(s => s.key === periodSeriesKey) ?? periodOptions[0];
 const plotRight = graphWidth - (periodSeries ? (compact ? 42 : 64) : (compact ? 8 : 20));
 const plotWidth = plotRight - plotLeft;
 const start=rows[0].time,end=rows.at(-1).time,span=end-start||1,x=t=>plotLeft+(t-start)/span*plotWidth;
 const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit' });
 const clockFormat = new Intl.DateTimeFormat('en-US', { timeZone:zone, hour:'numeric', minute:'2-digit' });
 const dayKey = time => dateFormat.format(time * 1000);
 const daylightByDay = new Map();
 for (const [i, sunrise] of (daylight?.sunrise ?? []).entries()) {
  const sunset = daylight.sunset?.[i];
  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunset <= sunrise || sunset <= start || sunrise >= end) continue;
  daylightByDay.set(dayKey(sunrise), { sunrise, sunset });
 }
 if (daylightByDay.size) {
  const key = document.createElement('span');
  key.className = 'week-daylight-key';
  key.textContent = 'Daylight shading · sunrise to sunset';
  legend.append(key);
 }
 function shadeDaylight(chart, top, bottom) {
  for (const {sunrise, sunset} of daylightByDay.values()) {
   const left = x(Math.max(start, sunrise));
   const right = x(Math.min(end, sunset));
   chart.append(svg('rect', { x:left, y:top, width:right-left, height:bottom-top, class:'week-daylight-band', 'aria-hidden':'true' }));
  }
 }
 const description = 'Seven-day ' + mode + ' forecast in ' + unit.trim() + ', in location time.' +
  (periodSeries ? ' Blue dots show ' + periodSeries.name + ' period on the right axis in seconds.' : '') +
  (daylightByDay.size ? ' Darker bands mark daylight.' : '') +
  ' Use the hourly slider and data table for exact values.';
 const graph = svg('svg', {viewBox:'0 0 '+graphWidth+' 310',role:'img','aria-label':description,class:'week-chart'});
 shadeDaylight(graph, 20, 260);
 const max = Math.max(mode==='height'?1:5,...shown.flatMap(s=>s.values.filter(Number.isFinite)))*1.12;
 const periods = periodSeries ? rows.map(row => row[periodSeries.period]).filter(hasPeriod) : [];
 const periodMax = 4 * Math.ceil(Math.max(20, ...periods)/4);
 const periodAxis = svg('g', {class:'week-period-axis','font-size':axisFont,'text-anchor':'end'});
 const rightLabelX = graphWidth - (compact ? 5 : 12);
 for (let i=0;i<5;i++) {
  const y=260-i*55;
  graph.append(svg('line',{x1:plotLeft,y1:y,x2:plotRight,y2:y,stroke:'#44394f'}),
   svg('text',{x:6,y:y+4,fill:'#b5a9c2','font-size':axisFont},(max*i/4).toFixed(1)+unit));
  if (periodSeries) periodAxis.append(svg('text', {x:rightLabelX,y:y+4}, periodMax*i/4 + ' s'));
 }
 if (periodSeries) {
  graph.append(svg('text', {x:6,y:18,fill:'#b5a9c2','font-size':axisFont}, 'Height'));
  periodAxis.append(svg('text', {x:rightLabelX,y:18}, 'Period'));
  graph.append(periodAxis);
 }
 const dates = new Map();
 for (const row of rows) {
  const day = dayKey(row.time);
  if (!dates.has(day)) dates.set(day, { x:x(row.time), text:fmt(row.time, { weekday:compact?'narrow':'short', day:'numeric' }) });
 }
 function dayMarks(chart, top, bottom, labelY) {
  for (const day of dates.values()) chart.append(
   svg('line', { x1:day.x, x2:day.x, y1:top, y2:bottom, class:'week-grid', 'stroke-dasharray':'3 5' }),
   svg('text', { x:Math.min(day.x+3,graphWidth-(compact?25:48)), y:labelY, class:'week-axis-label', 'font-size':axisFont }, day.text)
  );
 }
 dayMarks(graph, 20, 260, 289);
 for (const s of shown) {
  let path = '', active = false;
  s.values.forEach((value, i) => {
   if (!Number.isFinite(value)) { active = false; return; }
   const row = rows[i], xx = x(row.time), yy = 260-value/max*220;
   path += (active ? 'L' : 'M') + xx.toFixed(2) + ',' + yy.toFixed(2) + ' ';
   active = true;
  });
  graph.append(svg('path',{d:path,fill:'none',stroke:s.color,'stroke-width':s.key==='wave'?3:2,'stroke-linejoin':'round'}));
 }
 if (periodSeries) {
  const markers = svg('g', {class:'week-period-dots','aria-hidden':'true'});
  let lastX = -Infinity;
  for (const row of rows) {
   const xx = x(row.time), period = row[periodSeries.period];
   if (!hasPeriod(period) || xx-lastX < 12) continue;
   markers.append(svg('circle', {cx:xx,cy:260-period/periodMax*220,r:3.3}));
   lastX = xx;
  }
  graph.append(markers);
  const picker = document.createElement('div');
  picker.className = 'week-period-options';
  const periodLabel = document.createElement('label');
  periodLabel.htmlFor = 'week-period-series';
  periodLabel.textContent = 'Period dots';
  const periodSelect = document.createElement('select');
  periodSelect.id = periodLabel.htmlFor;
  for (const item of periodOptions) periodSelect.append(new Option(item.name, item.key));
  periodSelect.value = periodSeries.key;
  periodSelect.onchange = () => {
   periodSeriesKey = periodSelect.value;
   weekly(rows,options);
   document.getElementById('week-period-series').focus({preventScroll:true});
  };
  picker.append(periodLabel,periodSelect);
  root.append(picker);
 }
 if(selected<0||selected>=rows.length)selected=Math.max(0,rows.findIndex(r=>r.time>=Date.now()/1000));
 const charts = [];
 mountChart(root, { graph, top:20, bottom:260 }, (panel, row) => renderReadings(panel, row, waveReadings(row, shown)));
 const timeline = { svg, width:graphWidth, left:plotLeft, right:plotRight, x, start, end, dayMarks, shadeDaylight, axisFont, compact };
 const tides = tidePanel(root, tide, timeline, { units, heightUnit, scale });
 const wind = windPanel(root, rows, timeline, { speedUnit, speedScale });
 const extraReadings = [];
 if (tides) {
  const tideReading = row => ({ name:'Tide', color:tideColor, text:val(tides.reading(row), heightUnit) });
  extraReadings.push(tideReading);
  mountChart(tides.section, tides, (panel, row) => renderReadings(panel, row, [tideReading(row)]));
 }
 if (wind) {
  const windReading = row => ({ name:'Wind', color:windColor, text:val(wind.reading(row), speedUnit) +
   (row.speed === 0 ? ' · Calm' : Number.isFinite(row.wind_direction) ? ' · from ' + bearing(row.wind_direction) : '') });
  extraReadings.push(windReading);
  mountChart(wind.section, wind, (panel, row) => renderReadings(panel, row, [windReading(row)]));
 }
 const sliderLabel=document.createElement('label');sliderLabel.htmlFor='week-hour';sliderLabel.textContent='Inspect forecast hour · local time';const slider=document.createElement('input');slider.type='range';slider.id='week-hour';slider.min=0;slider.max=rows.length-1;slider.step=1;slider.value=selected;root.append(sliderLabel,slider);
 const readout=document.createElement('div');readout.className='week-readout';readout.setAttribute('aria-live','polite');root.append(readout);
 function waveReadings(row, items) {
  return items.map(item => ({ name:item.name, color:item.color,
   text:val(Number.isFinite(row[item.key]) ? row[item.key]*scale : null,heightUnit) +
   ' · ' + val(row[item.period],' s') + ' · from ' + bearing(row[item.direction]) }));
 }
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
   value.textContent = item.text;
   line.append(label, value);
   panel.append(line);
  }
  const sun = daylightByDay.get(dayKey(row.time));
  if (sun) {
   const times = document.createElement('span');
   times.className = 'week-daylight-times';
   times.textContent = `Sunrise ${clockFormat.format(sun.sunrise * 1000)} · Sunset ${clockFormat.format(sun.sunset * 1000)}`;
   panel.append(times);
  }
 }
 function position(line, xx) {
  line.setAttribute('x1', xx);
  line.setAttribute('x2', xx);
 }
 function mark(chart, row) {
  if (!chart.point) return;
  const value = chart.reading(row);
  chart.point.setAttribute('visibility', Number.isFinite(value) ? 'visible' : 'hidden');
  if (!Number.isFinite(value)) return;
  chart.point.setAttribute('cx', x(row.time));
  chart.point.setAttribute('cy', chart.y(value));
 }
 function inspect(i) {
  selected = Math.max(0, Math.min(rows.length-1, i));
  slider.value = selected;
  const row = rows[selected];
  for (const chart of charts) {
   position(chart.cursor, x(row.time));
   mark(chart, row);
  }
  renderReadings(readout, row, [...waveReadings(row, series), ...extraReadings.map(reading => reading(row))]);
 }
 function hourAt(clientX, chart) {
  const bounds = chart.getBoundingClientRect();
  const fraction = ((clientX-bounds.left)/bounds.width*graphWidth-plotLeft)/plotWidth;
  const instant = start + span*fraction;
  const next = rows.findIndex(row => row.time >= instant);
  if (next === -1) return rows.length-1;
  return next > 0 && instant-rows[next-1].time <= rows[next].time-instant ? next-1 : next;
 }
 function mountChart(parent, chart, render) {
  const { graph, top, bottom, point } = chart;
  const cursor = svg('line', { y1:top, y2:bottom, stroke:'#f0eaf6', 'stroke-dasharray':'4 4', class:'week-selected-cursor' });
  const hoverCursor = svg('line', { y1:top, y2:bottom, stroke:'#d7b9f5', visibility:'hidden', class:'week-hover-cursor' });
  graph.append(cursor, hoverCursor);
  if (point) graph.append(point);
  charts.push({ ...chart, cursor, hoverCursor });
  const plot = document.createElement('div');
  plot.className = 'week-plot';
  const tooltip = document.createElement('div');
  tooltip.className = 'week-tooltip';
  tooltip.hidden = true;
  tooltip.setAttribute('aria-hidden', 'true');
  plot.append(graph, tooltip);
  parent.append(plot);

  let hovered = -1;
  graph.onpointermove = event => {
   if (event.pointerType === 'touch') return;
   const index = hourAt(event.clientX, graph);
   if (hovered !== index) {
    hovered = index;
    const row = rows[index];
    render(tooltip, row);
    for (const item of charts) {
     position(item.hoverCursor, x(row.time));
     item.hoverCursor.setAttribute('visibility', 'visible');
     mark(item, row);
    }
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
   for (const item of charts) {
    item.hoverCursor.setAttribute('visibility', 'hidden');
    mark(item, rows[selected]);
   }
  };
  graph.onpointerdown = event => inspect(hourAt(event.clientX, graph));
 }
 slider.oninput = () => inspect(Number(slider.value));
 inspect(selected);
 const note=document.createElement('p');note.className='small';note.textContent='Combined sea includes wind waves and swell; heights are not added arithmetically. Missing data creates gaps. Swell partitions are model components, not tracked named storms, and may change order over time. Secondary/tertiary availability depends on the provider model. Tap a chart or use the hourly slider.';root.append(note);
 if (focusId) document.getElementById(focusId)?.focus({preventScroll:true});
}
