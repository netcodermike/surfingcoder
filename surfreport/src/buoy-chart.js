import { height } from './core.js?v=20261117-tides-wind';

const HOUR = 3600000;
const SERIES = [
  { label: 'Combined sea', color: '#b9de82', heightKey: 'wave', periodKey: 'period' },
  { label: 'Swell', color: '#a879e8', heightKey: 'swell', periodKey: 'swellPeriod' },
  { label: 'Wind waves', color: '#79bfff', heightKey: 'windWave', periodKey: 'windWavePeriod', dash: '6 4' },
];
const svg = (name, attrs, label) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  if (label) element.textContent = label;
  return element;
};

export function drawBuoyChart(readings, units, width, date, details, hiddenLayers) {
  const section = document.createElement('section');
  section.className = 'buoy-wave-chart';
  const title = document.createElement('h4');
  title.textContent = 'Observed waves · Last 24 hours';
  section.append(title);
  const end = Date.now(), start = end - 24 * HOUR;
  const rows = readings.filter(row => row.time >= start && row.time <= end).reverse();
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No readings in the last 24 hours. The table below shows the latest available records.';
    section.append(empty);
    return section;
  }

  width = Math.max(260, width);
  const left = 39, right = width - 39, top = 30, bottom = 223;
  const heightUnit = units === 'metric' ? 'm' : 'ft';
  const x = time => left + (right - left) * (time - start) / (end - start);
  const plot = document.createElement('div');
  plot.className = 'week-plot';
  const chart = svg('svg', { viewBox: `0 0 ${width} 272`, class: 'week-chart', role: 'img',
    'aria-label': 'Measured wave heights on the left, periods on the right, and local dates and times along the bottom.' });
  const legend = document.createElement('div');
  legend.className = 'week-legend';
  legend.setAttribute('role', 'group');
  legend.setAttribute('aria-label', 'Observed wave layers');
  const availableLayers = new Set();
  let heightMax = 1, periodMax = 4;
  for (const series of SERIES) {
    const heights = rows.map(row => row[series.heightKey]).filter(Number.isFinite);
    const periods = series.periodKey ? rows.map(row => row[series.periodKey]).filter(Number.isFinite) : [];
    heightMax = Math.max(heightMax, ...heights.map(value => height(value, units)));
    periodMax = Math.max(periodMax, ...periods);
    if (heights.length || periods.length) availableLayers.add(series.heightKey);
  }
  heightMax = Math.ceil(heightMax * 1.05);
  periodMax = Math.ceil(periodMax / 4) * 4;
  const y = (value, max) => bottom - value / max * (bottom - top);
  const axis = (xAt, yAt, label, anchor = 'start') =>
    svg('text', { x: xAt, y: yAt, 'text-anchor': anchor, class: 'week-axis-label', 'font-size': 11 }, label);
  chart.append(axis(6, 17, 'Height (' + heightUnit + ')'), axis(width - 6, 17, 'Period (s)', 'end'));
  for (let tick = 0; tick <= 4; tick++) {
    const yy = y(tick, 4);
    chart.append(svg('line', { x1: left, x2: right, y1: yy, y2: yy, class: 'week-grid' }),
      axis(6, yy + 4, String(Number((heightMax * tick / 4).toFixed(2)))),
      axis(width - 6, yy + 4, String(periodMax * tick / 4), 'end'));
  }
  const { timeZone } = date.resolvedOptions();
  const calendar = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
  const clock = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  const observationTime = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  const ticks = width < 370 ? 2 : width < 640 ? 3 : 6;
  for (let tick = 0; tick <= ticks; tick++) {
    const time = start + tick * (end - start) / ticks;
    const xx = x(time);
    const day = axis(xx, bottom + 18, calendar.format(time), 'middle');
    const hour = axis(xx, bottom + 35, clock.format(time), 'middle');
    day.classList.add('buoy-axis-date');
    hour.classList.add('buoy-axis-time');
    chart.append(svg('line', { x1: xx, x2: xx, y1: top, y2: bottom, class: 'week-grid' }), day, hour);
  }
  const layers = new Map();
  const isVisible = key => availableLayers.has(key) && !hiddenLayers.has(key);
  for (const series of SERIES) {
    const layer = svg('g', { 'data-observed-layer': series.heightKey });
    if (!isVisible(series.heightKey)) layer.style.display = 'none';
    layers.set(series.heightKey, layer);
    let path = '', previous = -Infinity;
    for (const row of rows) {
      const value = row[series.heightKey];
      if (!Number.isFinite(value)) { previous = -Infinity; continue; }
      path += (row.time - previous > 2 * HOUR ? 'M' : 'L') + x(row.time).toFixed(2) + ',' +
        y(height(value, units), heightMax).toFixed(2);
      previous = row.time;
    }
    const trace = svg('path', { d: path, fill: 'none', stroke: series.color, 'stroke-width': 2 });
    if (series.dash) trace.setAttribute('stroke-dasharray', series.dash);
    layer.append(trace);
    if (series.periodKey) {
      for (const row of rows) {
        const period = row[series.periodKey];
        if (!Number.isFinite(period)) continue;
        layer.append(svg('circle', { cx: x(row.time), cy: y(period, periodMax), r: 2.6,
          fill: series.color, stroke: series.color }));
      }
    }
    chart.append(layer);
  }
  const cursor = svg('line', { y1: top, y2: bottom, stroke: '#fff', opacity: .65, visibility: 'hidden' });
  chart.append(cursor);
  const popup = document.createElement('div');
  popup.className = 'week-tooltip buoy-wave-tooltip';
  popup.hidden = true;
  const hint = document.createElement('p');
  hint.className = 'buoy-reading-status';
  hint.textContent = 'Times are local. Lines show heights. Matching circles show periods.';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = 0;
  slider.max = rows.length - 1;
  slider.value = slider.max;
  slider.setAttribute('aria-label', 'Inspect buoy observation');

  for (const series of SERIES) {
    const key = series.heightKey;
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isVisible(key);
    checkbox.disabled = !availableLayers.has(key);
    const swatch = document.createElement('i');
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.background = series.dash
      ? `repeating-linear-gradient(to right, ${series.color} 0 6px, transparent 6px 9px)`
      : series.color;
    label.append(checkbox, swatch, series.label + (checkbox.disabled ? ' · unavailable' : ''));
    legend.append(label);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) hiddenLayers.delete(key);
      else hiddenLayers.add(key);
      layers.get(key).style.display = checkbox.checked ? '' : 'none';
      if (!popup.hidden) show(Number(slider.value));
      else slider.removeAttribute('aria-valuetext');
    });
  }

  function show(index) {
    const row = rows[index], xx = x(row.time);
    const stamp = document.createElement('strong');
    stamp.textContent = observationTime.format(row.time);
    popup.replaceChildren(stamp);
    const visibleLabels = new Set(SERIES.filter(series => isVisible(series.heightKey)).map(series => series.label));
    const groups = details(row).filter(([label]) => visibleLabels.has(label));
    for (const [label, metrics] of groups) {
      const line = document.createElement('div');
      line.className = 'buoy-wave-row';
      const name = document.createElement('b');
      name.textContent = label;
      line.append(name, ' · ' + metrics.map(([, value]) => value).join(' / '));
      popup.append(line);
    }
    popup.hidden = false;
    const plotWidth = plot.clientWidth;
    const anchor = xx * plotWidth / width;
    popup.style.left = Math.max(6, Math.min(anchor + 9, plotWidth - popup.offsetWidth - 6)) + 'px';
    cursor.setAttribute('x1', xx);
    cursor.setAttribute('x2', xx);
    cursor.setAttribute('visibility', 'visible');
    slider.value = index;
    slider.setAttribute('aria-valuetext', [stamp.textContent, ...groups.map(([label, metrics]) => [label, ...metrics.map(pair => pair.join(' '))].join(', '))].join(', '));
  }
  function inspect(event) {
    const rect = chart.getBoundingClientRect();
    const time = start + ((event.clientX - rect.left) * width / rect.width - left) / (right - left) * (end - start);
    const nearest = rows.reduce((best, row, i) => Math.abs(row.time - time) < Math.abs(rows[best].time - time) ? i : best, 0);
    show(nearest);
  }
  function hide() {
    popup.hidden = true;
    cursor.setAttribute('visibility', 'hidden');
  }
  chart.addEventListener('pointermove', event => { if (event.pointerType !== 'touch') inspect(event); });
  chart.addEventListener('pointerup', inspect);
  chart.addEventListener('pointerleave', hide);
  slider.addEventListener('input', () => show(Number(slider.value)));
  slider.addEventListener('focus', () => show(Number(slider.value)));
  slider.addEventListener('blur', hide);
  plot.append(chart, popup);
  section.append(legend, plot, hint, slider);
  return section;
}
