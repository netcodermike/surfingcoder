import { height } from './core.js?v=20261124-review';
import { appendMarkerCheckbox, createChartArrows, createDirectionIcon, hasDirection } from './chart-markers.js?v=20261123-observed-daylight';
import { dayRangeControl, formatDayRange } from './chart-ranges.js?v=20261124-five-days';
import { daylightIntervals } from './daylight.js?v=20261123-observed-daylight';

const HOUR = 3600000;
const ARROW_INTERVAL_PER_DAY = HOUR / 4;
const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const SERIES = [
  { label: 'Combined sea', color: 'var(--surf-combined-sea, #79bfff)', heightKey: 'wave', periodKey: 'period', directionKey: 'direction' },
  { label: 'Swell', color: 'var(--surf-swell, #a879e8)', heightKey: 'swell', periodKey: 'swellPeriod', directionKey: 'swellDirection' },
  { label: 'Wind waves', color: 'var(--surf-wind-wave, #d9c4f5)', heightKey: 'windWave', periodKey: 'windWavePeriod', directionKey: 'windWaveDirection', dash: '6 4' },
];
const svg = (name, attrs, label) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  if (label) element.textContent = label;
  return element;
};

function directionBearing(value) {
  if (typeof value !== 'string') return value;
  const point = COMPASS_POINTS.indexOf(value.trim().toUpperCase());
  return point >= 0 ? point * 22.5 : undefined;
}

function waveArrowSamples(rows, series, interval) {
  const samples = [];
  for (const row of rows) {
    const value = row[series.heightKey];
    const bearing = directionBearing(row[series.directionKey]);
    if (Number.isFinite(value) && value > 0 && hasDirection(bearing)) {
      samples.push({ time: row.time, value, bearing });
    }
  }
  if (!samples.length) return [];

  const arrows = [];
  let index = 0;
  // Space the targets in time, then attach each arrow to an actual measurement.
  for (let target = samples[0].time; target <= samples.at(-1).time; target += interval) {
    while (index + 1 < samples.length &&
      Math.abs(samples[index + 1].time - target) < Math.abs(samples[index].time - target)) {
      index++;
    }
    if (arrows.at(-1) !== samples[index]) arrows.push(samples[index]);
  }
  return arrows;
}

export function drawBuoyChart(readings, units, width, date, details, hiddenLayers, {
  days = 2, end = Date.now(), onRangeChange, station, selectedTime, onSelectTime,
} = {}) {
  const section = document.createElement('section');
  section.className = 'buoy-wave-chart';
  const toolbar = document.createElement('div');
  toolbar.className = 'week-toolbar';
  const title = document.createElement('h4');
  title.textContent = `Observed waves · Last ${formatDayRange(days)}`;
  toolbar.append(title, dayRangeControl('observation-days', 'Observed range', days, range => onRangeChange?.(range)));
  section.append(toolbar);
  const start = end - days * 24 * HOUR;
  const rows = readings.filter(row => row.time >= start && row.time <= end).reverse();
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.textContent = `No readings in the last ${formatDayRange(days)}.`;
    section.append(empty);
    return section;
  }

  width = Math.max(260, width);
  const left = 39, right = width - 39, top = 30, bottom = 223;
  const heightUnit = units === 'metric' ? 'm' : 'ft';
  const x = time => left + (right - left) * (time - start) / (end - start);
  const plot = document.createElement('div');
  plot.className = 'week-plot';
  const daylight = daylightIntervals(start, end, station);
  const description = 'Measured wave heights on the left, periods on the right, and local dates and times along the bottom.';
  const chart = svg('svg', { viewBox: `0 0 ${width} 272`, class: 'week-chart', role: 'img',
    'aria-label': description + (daylight.length ? ' Lighter shading marks daylight and darker shading marks night.' : '') });
  for (const band of daylight) {
    chart.append(svg('rect', {
      x: x(band.start), y: top, width: x(band.end) - x(band.start), height: bottom - top,
      class: 'week-daylight-band', 'aria-hidden': 'true',
    }));
  }
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
  const periodAxis = svg('g', { class: 'buoy-period-axis' });
  chart.append(axis(6, 17, 'Height (' + heightUnit + ')'), periodAxis);
  periodAxis.append(axis(width - 6, 17, 'Period (s)', 'end'));
  for (let tick = 0; tick <= 4; tick++) {
    const yy = y(tick, 4);
    chart.append(svg('line', { x1: left, x2: right, y1: yy, y2: yy, class: 'week-grid' }),
      axis(6, yy + 4, String(Number((heightMax * tick / 4).toFixed(2)))));
    periodAxis.append(axis(width - 6, yy + 4, String(periodMax * tick / 4), 'end'));
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
  const arrowLayers = [], periodLayers = [];
  const isVisible = key => availableLayers.has(key) && !hiddenLayers.has(key);
  const arrowInterval = days * ARROW_INTERVAL_PER_DAY;
  for (const series of SERIES) {
    const layer = svg('g', { 'data-observed-layer': series.heightKey });
    if (!isVisible(series.heightKey)) layer.style.display = 'none';
    layers.set(series.heightKey, layer);
    const heights = rows.filter(row => Number.isFinite(row[series.heightKey]));
    let path = '';
    const isolated = [];
    for (const [index, row] of heights.entries()) {
      // The basic and spectral feeds can report at different times.
      const joinsPrevious = index > 0 && row.time - heights[index - 1].time <= 2 * HOUR;
      const joinsNext = index + 1 < heights.length && heights[index + 1].time - row.time <= 2 * HOUR;
      const cx = x(row.time), cy = y(height(row[series.heightKey], units), heightMax);
      if (!joinsPrevious && !joinsNext) {
        isolated.push(svg('circle', { cx, cy, r: 3.4, fill: 'none', stroke: series.color, 'stroke-width': 1.7,
          class: 'buoy-isolated-height', 'aria-hidden': 'true' }));
      } else {
        path += (joinsPrevious ? 'L' : 'M') + cx.toFixed(2) + ',' + cy.toFixed(2);
      }
    }
    const trace = svg('path', { d: path, fill: 'none', stroke: series.color, 'stroke-width': 2 });
    if (series.dash) trace.setAttribute('stroke-dasharray', series.dash);
    layer.append(trace, ...isolated);
    const arrows = createChartArrows(svg, {
      className: 'buoy-wave-arrows', color: series.color, spacing: x(start + arrowInterval) - x(start), bottom: 230,
    });
    for (const { time, value, bearing } of waveArrowSamples(rows, series, arrowInterval)) {
      arrows.add(x(time), y(height(value, units), heightMax), bearing);
    }
    if (arrows.group.childElementCount) {
      layer.append(arrows.group);
      arrowLayers.push(arrows.group);
    }
    if (series.periodKey) {
      const dots = svg('g', { class: 'buoy-period-dots', 'aria-hidden': 'true' });
      for (const row of rows) {
        const period = row[series.periodKey];
        if (!Number.isFinite(period)) continue;
        dots.append(svg('circle', { cx: x(row.time), cy: y(period, periodMax), r: 2.6,
          fill: series.color, stroke: series.color }));
      }
      if (dots.childElementCount) {
        layer.append(dots);
        periodLayers.push(dots);
      }
    }
    chart.append(layer);
  }
  const cursor = svg('line', { y1: top, y2: bottom, class: 'buoy-cursor', stroke: '#fff', opacity: .65, visibility: 'hidden' });
  chart.append(cursor);
  const popup = document.createElement('div');
  popup.className = 'week-tooltip buoy-wave-tooltip';
  popup.hidden = true;
  const hint = document.createElement('p');
  hint.className = 'buoy-reading-status';
  const clockHint = timeZone === 'UTC' ? 'Times are in UTC.' : 'Times are in the forecast location’s time zone.';
  hint.textContent = clockHint + ' Lines and hollow circles show heights. Solid dots show periods and arrows show wave travel direction.';
  const slider = document.createElement('input');
  slider.id = 'buoy-reading-hour';
  slider.type = 'range';
  slider.min = 0;
  slider.max = rows.length - 1;
  slider.value = Number.isFinite(selectedTime) ? nearestIndex(selectedTime) : Number(slider.max);
  slider.setAttribute('aria-label', 'Inspect buoy observation');

  for (const series of SERIES) {
    const key = series.heightKey;
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'buoy-show-' + key;
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
  if (!periodLayers.length) periodAxis.style.display = 'none';
  for (const [key, label, elements] of [
    ['direction-arrows', 'Direction arrows', arrowLayers],
    ['period-dots', 'Period dots', periodLayers.length ? [periodAxis, ...periodLayers] : []],
  ]) {
    if (!elements.length) continue;
    const setVisibility = checked => {
      for (const element of elements) element.style.display = checked ? '' : 'none';
    };
    const checked = !hiddenLayers.has(key);
    setVisibility(checked);
    appendMarkerCheckbox(legend, {
      id: 'buoy-show-' + key, label, checked,
      onChange: visible => {
        if (visible) hiddenLayers.delete(key);
        else hiddenLayers.add(key);
        setVisibility(visible);
      },
    });
  }
  if (daylight.length) {
    const key = document.createElement('span');
    key.className = 'week-daylight-key';
    key.textContent = 'Lighter daylight · Darker night';
    legend.append(key);
  }

  function show(index, select = false) {
    const row = rows[index], xx = x(row.time);
    if (select) onSelectTime?.(row.time);
    const stamp = document.createElement('strong');
    stamp.textContent = observationTime.format(row.time);
    popup.replaceChildren(stamp);
    const visibleSeries = new Map(SERIES.filter(series => isVisible(series.heightKey))
      .map(series => [series.label, series]));
    const groups = details(row).filter(([label]) => visibleSeries.has(label));
    for (const [label, metrics] of groups) {
      const series = visibleSeries.get(label);
      const line = document.createElement('span');
      line.className = 'week-reading buoy-wave-row';
      line.style.setProperty('--series-color', series.color);
      const name = document.createElement('span');
      name.className = 'week-reading-label';
      name.textContent = label + ':';
      const values = document.createElement('span');
      const [[, waveHeight], [, period], [, direction]] = metrics;
      const source = document.createElement('span');
      source.style.whiteSpace = 'nowrap';
      source.textContent = direction;
      const bearing = directionBearing(row[series.directionKey]);
      if (hasDirection(bearing)) source.append(createDirectionIcon(svg, bearing));
      values.append(waveHeight + ' · ' + period + ' · ', source);
      line.append(name, values);
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
  function nearestIndex(time) {
    return rows.reduce((best, row, index) =>
      Math.abs(row.time - time) < Math.abs(rows[best].time - time) ? index : best, 0);
  }
  function inspect(event, select = false) {
    const rect = chart.getBoundingClientRect();
    const time = start + ((event.clientX - rect.left) * width / rect.width - left) / (right - left) * (end - start);
    show(nearestIndex(time), select);
  }
  function hide() {
    popup.hidden = true;
    cursor.setAttribute('visibility', 'hidden');
  }
  chart.addEventListener('pointermove', event => { if (event.pointerType !== 'touch') inspect(event); });
  chart.addEventListener('pointerup', event => inspect(event, true));
  chart.addEventListener('pointerleave', hide);
  slider.addEventListener('input', () => show(Number(slider.value), true));
  slider.addEventListener('focus', () => show(Number(slider.value)));
  slider.addEventListener('blur', hide);
  plot.append(chart, popup);
  section.append(legend, plot, hint, slider);
  return section;
}
