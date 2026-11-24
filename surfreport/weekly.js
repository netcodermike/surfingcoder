import { rainColor, rainProbability, seriesLegend, temperatureColor, tideColor, tideWindPanel, weatherPanel, windColor } from './forecast-panels.js?v=20261124-review';
import { compass } from './src/core.js?v=20261124-review';
import { appendMarkerCheckbox, createChartArrows, createDirectionIcon, DIRECTION_INTERVAL_SECONDS, hasDirection } from './src/chart-markers.js?v=20261123-observed-daylight';
import { dayRangeControl, forecastWindow } from './src/chart-ranges.js?v=20261124-five-days';

const components = [
 ['wave', 'Combined sea', 'var(--surf-combined-sea, #79bfff)', 'period', 'direction'],
 ['swell', 'Swell', 'var(--surf-swell, #a879e8)', 'swellPeriod', 'swellDirection'],
 ['secondary', 'Secondary swell', 'var(--surf-secondary-swell, #e8bd78)', 'secondaryPeriod', 'secondaryDirection'],
 ['tertiary', 'Tertiary swell', 'var(--surf-tertiary-swell, #e190b9)', 'tertiaryPeriod', 'tertiaryDirection'],
 ['windWave', 'Wind waves', 'var(--surf-wind-wave, #d9c4f5)', 'windWavePeriod', 'windWaveDirection', '6 4'],
];
const enabled = new Set([
 'wave', 'swell', 'secondary', 'tertiary', 'windWave', 'tide', 'wind', 'temperature', 'rain',
 'wave-direction-arrows', 'wave-period-dots', 'wind-direction-arrows',
]);
let selectedTime;
let graphWidth = 1000;
let markerSeriesKey = 'wave';
let dismissTap;
const ns='http://www.w3.org/2000/svg';
function svg(tag,attrs,text){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!=null)e.textContent=text;return e;}
const val=(v,suffix)=>Number.isFinite(v)?v.toFixed(1)+suffix:'—';
const bearing=d=>Number.isFinite(d)?compass(d):'—';
const hasPeriod = value => Number.isFinite(value) && value > 0;

const cloud = 'M4 10h7.5a2.4 2.4 0 1 0-.25-4.8A3.6 3.6 0 0 0 4.5 6H4a2 2 0 1 0 0 4Z';
const weatherIcons = {
 temperature: {
  cold:'M8 1.5v13M2.4 4.75l11.2 6.5m0-6.5-11.2 6.5M6.3 3.2 8 4.9l1.7-1.7M6.3 12.8 8 11.1l1.7 1.7',
  mild:'M6.5 9.25V3.5a1.5 1.5 0 0 1 3 0v5.75a3 3 0 1 1-3 0ZM8 7.5v4.25',
  hot:'M8 5a3 3 0 1 0 0 6 3 3 0 1 0 0-6ZM8 1.5v1.3m0 10.4v1.3M1.5 8h1.3m10.4 0h1.3M3.4 3.4l.9.9m7.4 7.4.9.9m0-9.2-.9.9m-7.4 7.4-.9.9',
 },
 rain: {
  low:cloud,
  medium:cloud + ' M8.7 12l-1 1.7',
  high:cloud + ' M5.5 12l-1 1.7m4.2-1.7-1 1.7m4.2-1.7-1 1.7',
 },
};
function weatherLevel(kind, value) {
 if (kind === 'temperature') {
  if (value <= 32) return 'cold';
  return value >= 85 ? 'hot' : 'mild';
 }
 if (value < 20) return 'low';
 return value < 60 ? 'medium' : 'high';
}
function weatherIcon(kind, value) {
 const level = weatherLevel(kind, value);
 const icon = svg('svg', {
  width:14, height:14, viewBox:'0 0 16 16', 'data-weather-icon':kind, 'data-weather-level':level,
  'aria-hidden':'true', focusable:'false', style:'margin-inline-end:5px; vertical-align:-0.18em',
 });
 icon.append(svg('path', {
  d:weatherIcons[kind][level], fill:'none', stroke:'currentColor', 'stroke-width':1.5,
  'stroke-linejoin':'round', 'stroke-linecap':'round',
 }));
 return icon;
}

export function weekly(forecastRows,options){
 const {zone,units,tide,daylight,location,days,onRangeChange,now}=options;
 dismissTap?.abort();
 dismissTap = undefined;
 const duration = { 1:'One-day', 2:'Two-day', 3:'Three-day', 5:'Five-day', 7:'Seven-day' }[days];
 const root = document.getElementById('weekly');
 const active = document.activeElement;
 const focusId = root.contains(active) ? active.id : '';
 const heading = document.createElement('h2');
 heading.id = 'swell-heading';
 const title = duration + ' swell explorer';
 heading.textContent = location ? location + ' · ' + title : title;
 const toolbar = document.createElement('div');
 toolbar.className = 'week-toolbar';
 toolbar.append(heading, dayRangeControl('forecast-days', 'Forecast range', days, onRangeChange));
 root.replaceChildren(toolbar);
 if (!forecastRows.length) {
  if (focusId) document.getElementById(focusId)?.focus({preventScroll:true});
  return [];
 }
 const firstForecastHour = forecastRows[0].time;
 const { rows, start, end } = forecastWindow(forecastRows, days, now);
 if (!rows.length) {
  const status = document.createElement('p');
  status.textContent = 'No forecast readings in this range.';
  root.append(status);
  if (focusId) document.getElementById(focusId)?.focus({preventScroll:true});
  return [];
 }
 if (root.clientWidth) graphWidth = Math.max(260, root.clientWidth);
 const compact = graphWidth < 520;
 const plotLeft = compact ? 49 : 65;
 const axisFont = compact ? 10 : 13;
 const fmt=(t,opt)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,...opt}).format(new Date(t*1000));
 const imperial = units === 'imperial';
 const scale=imperial?3.28084:1,heightUnit=imperial?' ft':' m';
 const speedScale = imperial ? .621371 : 1, speedUnit = imperial ? ' mph' : ' km/h';
 const series=components.map(([key,name,color,period,direction,dash])=>({
  key,name,color,period,direction,dash,
  values:rows.map(row=>Number.isFinite(row[key]) ? row[key]*scale : null),
  available:rows.some(row=>Number.isFinite(row[key])),
 }))
  .filter(item => item.key !== 'tertiary' || item.available);
 const toggleLayer = (key, visible) => {
  if (visible) enabled.add(key);
  else enabled.delete(key);
  weekly(forecastRows, options);
 };
 const legend = seriesLegend(series, enabled, toggleLayer, 'Wave forecast layers');
 root.append(legend);
 const shown = series.filter(s => s.available && enabled.has(s.key));
 const interval = DIRECTION_INTERVAL_SECONDS;
 const canDrawDirection = (row, value, key) => (row.time - firstForecastHour) % interval === 0 &&
  Number.isFinite(value) && value > 0 && hasDirection(row[key]);
 const markerOptions = shown.map(series => ({
  ...series,
  hasPeriods: rows.some(row => hasPeriod(row[series.period])),
  hasDirections: rows.some((row, i) => canDrawDirection(row, series.values[i], series.direction)),
 })).filter(series => series.hasPeriods || series.hasDirections);
 const markerSeries = markerOptions.find(series => series.key === markerSeriesKey) ?? markerOptions[0];
 const showDirections = enabled.has('wave-direction-arrows') && markerSeries?.hasDirections;
 const periodSeries = enabled.has('wave-period-dots') && markerSeries?.hasPeriods ? markerSeries : undefined;
 const hasRightAxis = periodSeries || (enabled.has('wind') && rows.some(row => Number.isFinite(row.speed))) ||
  (enabled.has('rain') && rows.some(row => rainProbability(row) !== null));
 const plotRight = graphWidth - (hasRightAxis ? (compact ? 46 : 64) : (compact ? 8 : 20));
 const plotWidth = plotRight - plotLeft;
 const span=end-start||1,x=t=>plotLeft+(t-start)/span*plotWidth;
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
  key.textContent = 'Lighter daylight · Darker night';
  legend.append(key);
 }
 for (const [key, label, available] of [
  ['wave-direction-arrows', 'Direction arrows', markerOptions.some(series => series.hasDirections)],
  ['wave-period-dots', 'Period dots', markerOptions.some(series => series.hasPeriods)],
 ]) {
  if (available) appendMarkerCheckbox(legend, {
   id:'week-show-' + key, label, checked:enabled.has(key), onChange:checked => toggleLayer(key, checked),
  });
 }
 function shadeDaylight(chart, top, bottom) {
  for (const {sunrise, sunset} of daylightByDay.values()) {
   const left = x(Math.max(start, sunrise));
   const right = x(Math.min(end, sunset));
   chart.append(svg('rect', { x:left, y:top, width:right-left, height:bottom-top, class:'week-daylight-band', 'aria-hidden':'true' }));
  }
 }
 const description = duration + ' height forecast in ' + heightUnit.trim() + ', in location time.' +
  (periodSeries ? ' Dots show ' + periodSeries.name + ' period on the right axis in seconds.' : '') +
  (showDirections ? ' Arrows show the direction of ' + markerSeries.name + ' wave travel.' : '') +
  (daylightByDay.size ? ' Lighter bands mark daylight and darker bands mark night.' : '') +
  ' Use the hourly slider and data table for exact values.';
 const graph = svg('svg', {viewBox:'0 0 '+graphWidth+' 272',role:'img','aria-label':description,class:'week-chart'});
 shadeDaylight(graph, 20, 260);
 const max = Math.max(1,...shown.flatMap(s=>s.values.filter(Number.isFinite)))*1.12;
 const yValue = value => 260 - value / max * 220;
 const periods = periodSeries ? rows.map(row => row[periodSeries.period]).filter(hasPeriod) : [];
 const periodMax = 4 * Math.ceil(Math.max(20, ...periods)/4);
 const periodAxis = svg('g', {class:'week-period-axis','font-size':axisFont,'text-anchor':'end'});
 const rightLabelX = graphWidth - (compact ? 5 : 12);
 for (let i=0;i<5;i++) {
  const y=260-i*55;
  graph.append(svg('line',{x1:plotLeft,y1:y,x2:plotRight,y2:y,stroke:'#44394f',class:'week-grid'}),
   svg('text',{x:6,y:y+4,fill:'#b5a9c2','font-size':axisFont,class:'week-axis-label'},(max*i/4).toFixed(1)+heightUnit));
  if (periodSeries) periodAxis.append(svg('text', {x:rightLabelX,y:y+4}, periodMax*i/4 + ' s'));
 }
 if (periodSeries) {
  periodAxis.setAttribute('fill', periodSeries.color);
  graph.append(svg('text', {x:6,y:18,fill:'#b5a9c2','font-size':axisFont,class:'week-axis-label'}, 'Height'));
  periodAxis.append(svg('text', {x:rightLabelX,y:18}, 'Period'));
  graph.append(periodAxis);
 }
 const dates = new Map();
 const firstDay = dayKey(start);
 for (const row of rows) {
  const day = dayKey(row.time);
  if (!dates.has(day)) dates.set(day, { x:x(day === firstDay ? start : row.time), text:fmt(row.time, { weekday:compact?'narrow':'short', day:'numeric' }) });
 }
 function dayMarks(chart, top, bottom) {
  for (const day of dates.values()) chart.append(svg('line', {
   x1:day.x, x2:day.x, y1:top, y2:bottom, class:'week-grid', 'stroke-dasharray':'3 5',
  }));
 }
 function addDateAxis({ graph: chart, dateAxis: { height, labelY } }) {
  chart.setAttribute('viewBox', '0 0 ' + graphWidth + ' ' + height);
  let nextLabelX = 0;
  for (const day of dates.values()) {
   const labelX = Math.min(day.x + 3, graphWidth - (compact ? 25 : 48));
   if (labelX < nextLabelX) continue;
   const label = svg('text', { x:labelX, y:labelY, class:'week-axis-label week-date-label', 'font-size':axisFont }, day.text);
   chart.append(label);
   nextLabelX = labelX + label.getComputedTextLength() + 5;
  }
 }
 dayMarks(graph, 20, 260);
 for (const s of shown) {
  let path = '', previous = -Infinity;
  s.values.forEach((value, i) => {
   if (!Number.isFinite(value)) { previous = -Infinity; return; }
   const row = rows[i], xx = x(row.time), yy = yValue(value);
   path += (row.time - previous <= 3600 ? 'L' : 'M') + xx.toFixed(2) + ',' + yy.toFixed(2) + ' ';
   previous = row.time;
  });
  const trace = svg('path',{d:path,fill:'none',stroke:s.color,'stroke-width':s.key==='wave'?3:2,'stroke-linejoin':'round'});
  if (s.dash) trace.setAttribute('stroke-dasharray', s.dash);
  graph.append(trace);
 }
 if (showDirections) {
  const arrows = createChartArrows(svg, {
   className:'week-wave-arrows', color:markerSeries.color, spacing:x(start + interval) - x(start), bottom:270,
  });
  for (const [i, row] of rows.entries()) {
   const value = markerSeries.values[i];
   if (canDrawDirection(row, value, markerSeries.direction)) arrows.add(x(row.time), yValue(value), row[markerSeries.direction]);
  }
  graph.append(arrows.group);
 }
 if (periodSeries) {
  const markers = svg('g', {class:'week-period-dots',fill:periodSeries.color,'aria-hidden':'true'});
  let lastX = -Infinity;
  for (const row of rows) {
   const xx = x(row.time), period = row[periodSeries.period];
   if (!hasPeriod(period) || xx-lastX < 12) continue;
   markers.append(svg('circle', {cx:xx,cy:260-period/periodMax*220,r:3.3}));
   lastX = xx;
  }
  graph.append(markers);
 }
 if (markerSeries) {
  const picker = document.createElement('div');
  picker.className = 'week-period-options';
  const periodLabel = document.createElement('label');
  periodLabel.htmlFor = 'week-period-series';
  periodLabel.textContent = 'Period & direction';
  periodLabel.style.color = markerSeries.color;
  const periodSelect = document.createElement('select');
  periodSelect.id = periodLabel.htmlFor;
  for (const item of markerOptions) periodSelect.append(new Option(item.name, item.key));
  periodSelect.value = markerSeries.key;
  periodSelect.onchange = () => {
   markerSeriesKey = periodSelect.value;
   weekly(forecastRows,options);
   document.getElementById('week-period-series').focus({preventScroll:true});
  };
  picker.append(periodLabel,periodSelect);
  root.append(picker);
 }
 let selected = Math.max(0, rows.findIndex(row => row.time === selectedTime));
 const charts = [];
 const tooltip = document.createElement('div');
 tooltip.className = 'week-tooltip week-forecast-tooltip';
 tooltip.hidden = true;
 tooltip.setAttribute('aria-hidden', 'true');
 let tooltipIndex = -1, tooltipMode;
 const timeline = { svg, width:graphWidth, left:plotLeft, right:plotRight, x, start, end, duration, firstForecastHour, dayMarks, shadeDaylight, axisFont, compact };
 if (shown.length) mountChart(root, { graph, top:20, bottom:260, dateAxis: { height:310, labelY:289 } });
 const tideWind = tideWindPanel(root, rows, tide, timeline, { heightUnit, scale, speedUnit, speedScale }, enabled, toggleLayer);
 const weather = weatherPanel(root, rows, timeline, enabled, toggleLayer);
 const seaConditions = [], airConditions = [];
 if (tideWind) {
  if (tideWind.tideReading) seaConditions.push(row => ({ name:'Tide', color:tideColor, text:val(tideWind.tideReading(row), heightUnit) }));
  if (tideWind.windReading) seaConditions.push(row => ({ name:'Wind', color:windColor, text:val(tideWind.windReading(row), speedUnit) +
   (row.speed === 0 ? ' · Calm' : ''),
   direction:row.speed !== 0 && Number.isFinite(row.wind_direction) ? row.wind_direction : undefined }));
  mountChart(tideWind.section, tideWind);
 }
 let rainReading;
 if (weather) {
  if (weather.temperatureReading) airConditions.push(row => {
   const value = weather.temperatureReading(row);
   return { name:'Air temperature', color:temperatureColor, icon:'temperature', iconValue:value, text:val(value, ' °F') };
  });
  if (weather.rainReading) rainReading = row => {
   const value = weather.rainReading(row);
   return { name:'Rain chance', color:rainColor, icon:'rain', iconValue:value, text:val(value, '%') };
  };
  mountChart(weather.section, weather);
 }
 if (charts.length) addDateAxis(charts.at(-1));
 root.append(tooltip);
 const sliderLabel=document.createElement('label');sliderLabel.htmlFor='week-hour';sliderLabel.textContent='Inspect forecast hour · local time';const slider=document.createElement('input');slider.type='range';slider.id='week-hour';slider.min=0;slider.max=rows.length-1;slider.step=1;slider.value=selected;root.append(sliderLabel,slider);
 const readout=document.createElement('div');readout.className='week-readout';readout.setAttribute('aria-live','polite');root.append(readout);
 function waveReadings(row, items) {
  return items.map(item => ({ name:item.name, color:item.color,
   text:val(Number.isFinite(row[item.key]) ? row[item.key]*scale : null,heightUnit) +
   ' · ' + val(row[item.period],' s'), direction:row[item.direction] ?? null }));
 }
 function renderReadings(panel, row, groups) {
  const isPopup = panel === tooltip;
  const heading = document.createElement('strong');
  heading.textContent = fmt(row.time,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  panel.replaceChildren(heading);
  groups.filter(group => group.length).forEach((items, i) => {
   if (i) {
    const divider = document.createElement('hr');
    divider.className = 'week-tooltip-divider';
    panel.append(divider);
   }
   for (const item of items) {
    const line = document.createElement('span');
    line.className = 'week-reading';
    line.style.setProperty('--series-color', item.color);
    const label = document.createElement('span');
    label.className = 'week-reading-label';
    label.textContent = item.name + ':';
    if (isPopup && item.icon && Number.isFinite(item.iconValue)) label.prepend(weatherIcon(item.icon, item.iconValue));
    const value = document.createElement('span');
    value.textContent = item.text;
    if (item.direction !== undefined) {
     const source = document.createElement('span');
     source.style.whiteSpace = 'nowrap';
     source.textContent = bearing(item.direction);
     if (isPopup && Number.isFinite(item.direction)) source.append(createDirectionIcon(svg, item.direction));
     value.append(isPopup ? ' · ' : ' · from ', source);
    }
    line.append(label, value);
    panel.append(line);
   }
  });
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
  for (const { point, reading, y } of chart.markers ?? []) {
   const value = reading(row);
   point.setAttribute('visibility', Number.isFinite(value) ? 'visible' : 'hidden');
   if (!Number.isFinite(value)) continue;
   point.setAttribute('cx', x(row.time));
   point.setAttribute('cy', y(value));
  }
 }
 function inspect(i) {
  selected = Math.max(0, Math.min(rows.length-1, i));
  slider.value = selected;
  const row = rows[selected];
  const stamp = fmt(row.time,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  const chance = rainReading?.(row);
  slider.setAttribute('aria-valuetext', chance ? stamp + ', Rain chance ' + chance.text : stamp);
  selectedTime = row.time;
  for (const chart of charts) {
   position(chart.cursor, x(row.time));
   mark(chart, row);
  }
  renderReadings(readout, row, [[...waveReadings(row, series), ...[...seaConditions, ...airConditions].map(reading => reading(row))]]);
 }
 function hideTooltip() {
  dismissTap?.abort();
  dismissTap = undefined;
  tooltipMode = undefined;
  tooltip.hidden = true;
  for (const chart of charts) {
   chart.hoverCursor.setAttribute('visibility', 'hidden');
   mark(chart, rows[selected]);
  }
 }
 function showTooltip(index, anchorX, anchorY, interaction) {
  const row = rows[index];
  const indexChanged = tooltipIndex !== index;
  if (indexChanged) {
   tooltipIndex = index;
   const weatherData = airConditions.map(reading => reading(row));
   if (rainReading) weatherData.push(rainReading(row));
   renderReadings(tooltip, row, [waveReadings(row, shown), seaConditions.map(reading => reading(row)), weatherData]);
  }
  if (tooltipMode !== interaction || indexChanged) {
   for (const chart of charts) {
    chart.hoverCursor.setAttribute('visibility', interaction === 'hover' ? 'visible' : 'hidden');
    position(chart.hoverCursor, x(row.time));
    mark(chart, row);
   }
  }
  if (interaction !== 'tap') {
   dismissTap?.abort();
   dismissTap = undefined;
  }
  tooltipMode = interaction;
  tooltip.hidden = false;
  const viewportWidth = document.documentElement.clientWidth, viewportHeight = window.innerHeight;
  const left = anchorX + 14 + tooltip.offsetWidth <= viewportWidth ? anchorX + 14 : anchorX - 14 - tooltip.offsetWidth;
  const top = anchorY + 14 + tooltip.offsetHeight <= viewportHeight ? anchorY + 14 : anchorY - 14 - tooltip.offsetHeight;
  tooltip.style.left = Math.max(6, Math.min(left, viewportWidth - tooltip.offsetWidth - 6)) + 'px';
  tooltip.style.top = Math.max(6, Math.min(top, viewportHeight - tooltip.offsetHeight - 6)) + 'px';
 }
 function showSliderTooltip() {
  if (!charts.length) return;
  const bounds = slider.getBoundingClientRect();
  const sliderFraction = selected / Math.max(1, rows.length - 1);
  showTooltip(selected, bounds.left + bounds.width * sliderFraction, bounds.top, 'slider');
 }
 function showTapTooltip(event, graph) {
  const index = hourAt(event.clientX, graph);
  inspect(index);
  if (tooltipMode === 'tap' && tooltipIndex === index) {
   hideTooltip();
   return;
  }
  showTooltip(index, event.clientX, event.clientY, 'tap');
  dismissTap?.abort();
  dismissTap = new AbortController();
  document.addEventListener('pointerdown', event => {
   if (!charts.some(({ graph }) => graph.contains(event.target))) hideTooltip();
  }, { signal:dismissTap.signal });
 }
 function hourAt(clientX, chart) {
  const bounds = chart.getBoundingClientRect();
  const fraction = ((clientX-bounds.left)/bounds.width*graphWidth-plotLeft)/plotWidth;
  const instant = start + span*fraction;
  const next = rows.findIndex(row => row.time >= instant);
  if (next === -1) return rows.length-1;
  return next > 0 && instant-rows[next-1].time <= rows[next].time-instant ? next-1 : next;
 }
 function mountChart(parent, chart) {
  const { graph, top, bottom, markers } = chart;
  const cursor = svg('line', { y1:top, y2:bottom, stroke:'#f0eaf6', 'stroke-dasharray':'4 4', class:'week-selected-cursor' });
  const hoverCursor = svg('line', { y1:top, y2:bottom, stroke:'#d7b9f5', visibility:'hidden', class:'week-hover-cursor' });
  graph.append(cursor, hoverCursor);
  if (markers) graph.append(...markers.map(marker => marker.point));
  charts.push({ ...chart, cursor, hoverCursor });
  const plot = document.createElement('div');
  plot.className = 'week-plot';
  plot.append(graph);
  parent.append(plot);

  graph.onpointermove = event => {
   if (event.pointerType === 'touch') return;
   showTooltip(hourAt(event.clientX, graph), event.clientX, event.clientY, 'hover');
  };
  graph.onpointerleave = graph.onpointercancel = () => {
   if (tooltipMode === 'hover') hideTooltip();
  };
  graph.onpointerdown = event => {
   if (event.pointerType !== 'touch' && event.button === 0) inspect(hourAt(event.clientX, graph));
  };
  graph.onpointerup = event => {
   if (event.pointerType === 'touch') showTapTooltip(event, graph);
  };
 }
 slider.oninput = () => {
  inspect(Number(slider.value));
  if (document.activeElement === slider) showSliderTooltip();
 };
 slider.onfocus = showSliderTooltip;
 slider.onblur = () => { if (tooltipMode === 'slider') hideTooltip(); };
 slider.onkeydown = event => { if (event.key === 'Escape' && tooltipMode === 'slider') hideTooltip(); };
 inspect(selected);
 const note=document.createElement('p');note.className='small';note.textContent='Combined sea includes wind waves and swell; heights are not added arithmetically. Arrows show where the selected waves are traveling. Missing data creates gaps. Swell partitions are model components, not tracked named storms, and may change order over time. Secondary/tertiary availability depends on the provider model. Tap a chart or use the hourly slider.';root.append(note);
 if (focusId) document.getElementById(focusId)?.focus({preventScroll:true});
 return rows;
}
