import { height } from './core.js?v=20261117-tides-wind';

const HOUR = 3600000;
const SERIES = [
  { label: 'Wind waves', color: '#b9de82', heightKey: 'windWave' },
  { label: 'Swell', color: '#a879e8', heightKey: 'swell', periodKey: 'swellPeriod' },
  { label: 'Combined sea', color: '#d9c4f5', heightKey: 'wave', periodKey: 'period', dash: '6 4' },
];
const svg = (name, attrs, label) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  if (label) element.textContent = label;
  return element;
};

export function drawBuoyChart(readings, units, width, date, details) {
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
  const chart = svg('svg', { viewBox: `0 0 ${width} 258`, class: 'week-chart', role: 'img',
    'aria-label': 'Measured wave heights on the left axis. Peak period and swell period are on the right axis.' });
  const legend = document.createElement('p');
  legend.className = 'buoy-chart-legend';
  let heightMax = 1, periodMax = 4;
  for (const series of SERIES) {
    const heights = rows.map(row => row[series.heightKey]).filter(Number.isFinite);
    const periods = series.periodKey ? rows.map(row => row[series.periodKey]).filter(Number.isFinite) : [];
    heightMax = Math.max(heightMax, ...heights.map(value => height(value, units)));
    periodMax = Math.max(periodMax, ...periods);
    const key = document.createElement('span');
    key.style.color = series.color;
    key.textContent = series.label + (heights.length || periods.length ? '' : ' unavailable');
    legend.append(key);
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
  const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const ticks = width < 490 ? 3 : 6;
  for (let tick = 0; tick <= ticks; tick++) {
    const time = start + tick * (end - start) / ticks;
    const xx = x(time);
    chart.append(svg('line', { x1: xx, x2: xx, y1: top, y2: bottom, class: 'week-grid' }),
      axis(xx, bottom + 19, clock.format(time), 'middle'));
  }
  for (const series of SERIES) {
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
    chart.append(trace);
  }
  for (const series of SERIES) {
    if (!series.periodKey) continue;
    for (const row of rows) {
      const period = row[series.periodKey];
      if (!Number.isFinite(period)) continue;
      chart.append(svg('circle', { cx: x(row.time), cy: y(period, periodMax), r: 2.6,
        fill: series.color, stroke: series.color }));
    }
  }
  const cursor = svg('line', { y1: top, y2: bottom, stroke: '#fff', opacity: .65, visibility: 'hidden' });
  chart.append(cursor);
  const popup = document.createElement('div');
  popup.className = 'week-tooltip buoy-wave-tooltip';
  popup.hidden = true;
  const hint = document.createElement('p');
  hint.className = 'buoy-reading-status';
  hint.textContent = 'Lines show heights. Circles show peak period and swell period.';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = 0;
  slider.max = rows.length - 1;
  slider.value = slider.max;
  slider.setAttribute('aria-label', 'Inspect buoy observation');

  function show(index) {
    const row = rows[index], xx = x(row.time);
    const stamp = document.createElement('strong');
    stamp.textContent = date.format(row.time);
    popup.replaceChildren(stamp);
    const values = details(row);
    for (const [label, value] of values) {
      const line = document.createElement('span');
      line.textContent = label + ' · ' + value;
      popup.append(line);
    }
    popup.hidden = false;
    popup.style.left = Math.max(6, Math.min(xx + 9, width - popup.offsetWidth - 6)) + 'px';
    cursor.setAttribute('x1', xx);
    cursor.setAttribute('x2', xx);
    cursor.setAttribute('visibility', 'visible');
    slider.value = index;
    slider.setAttribute('aria-valuetext', [stamp.textContent, ...values.map(pair => pair.join(' '))].join(', '));
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
