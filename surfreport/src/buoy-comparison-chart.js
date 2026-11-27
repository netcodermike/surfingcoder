import { height } from './core.js?v=20261124-review';

const HOUR = 3_600_000;
const SERIES = [
  { name: 'model', heightKey: 'modelHeight' },
  { name: 'observed', heightKey: 'observedHeight' },
];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function svg(tag, attrs, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}

function timeElement(time, formatter) {
  const node = element('time', '', formatter.format(time));
  node.dateTime = new Date(time).toISOString();
  return node;
}

function comparisonSeries(chart, series, rows, x, y) {
  const { name, heightKey } = series;
  const layer = svg('g', { class: 'comparison-series comparison-' + name });
  let trace = '';
  rows.forEach((row, index) => {
    if (!Number.isFinite(row[heightKey])) return;
    const previous = rows[index - 1], next = rows[index + 1];
    const joinsPrevious = Number.isFinite(previous?.[heightKey]) && row.time - previous.time <= HOUR;
    const joinsNext = Number.isFinite(next?.[heightKey]) && next.time - row.time <= HOUR;
    const cx = x(row.time), cy = y(row[heightKey]);
    if (joinsPrevious || joinsNext) {
      trace += (joinsPrevious ? 'L' : 'M') + cx.toFixed(2) + ',' + cy.toFixed(2);
    } else {
      layer.append(svg('circle', { class: 'comparison-marker', cx, cy, r: 3 }));
    }
  });
  layer.prepend(svg('path', { class: 'comparison-line', d: trace }));
  const cursor = svg('circle', { class: 'comparison-marker', r: 4, visibility: 'hidden' });
  chart.append(layer);
  return cursor;
}

export function renderBuoyComparison(container, {
  station, rows = [], units = 'imperial', timeZone = 'UTC', width, status = '', loading = false,
} = {}) {
  const existingSlider = container.querySelector('input[type="range"]');
  const sameStation = container.dataset.station === station?.id;
  const priorTime = sameStation && existingSlider ? Number(existingSlider.dataset.selectedTime) : undefined;
  const restoreFocus = document.activeElement === existingSlider;
  container.hidden = !station;
  container.replaceChildren();
  if (!station) return;
  container.dataset.station = station.id;

  const heading = element('h3', '', 'Forecast vs. observed at the buoy');
  heading.id = 'buoy-comparison-heading';
  const stationLabel = element('p', 'comparison-station', station.id + ' · ' + station.name);
  const subtitle = element('p', 'comparison-subtitle', 'Significant wave height · Last 48 hours');
  container.append(heading, stationLabel, subtitle);
  if (status || loading || !rows.length) {
    const text = status || (loading ? 'Loading buoy wave heights…' : 'Wave-height comparison is unavailable.');
    const message = element('p', 'comparison-note', text);
    message.setAttribute('role', 'status');
    container.append(message);
  }
  if (!rows.length) return;

  const modelSource = 'Open‑Meteo historical model estimate';
  const observedSource = 'NOAA buoy observation';
  const legend = element('ul', 'comparison-legend');
  legend.setAttribute('aria-label', 'Wave height series');
  legend.append(
    element('li', 'comparison-model', modelSource),
    element('li', 'comparison-observed', observedSource),
  );

  const formatHeight = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tickHeight = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const localDate = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' });
  const localHour = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  const localTime = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  const unit = units === 'metric' ? 'm' : 'ft';
  const size = value => formatHeight.format(height(value, units)) + ' ' + unit;

  const latest = Math.max(...rows.map(row => row.time));
  const start = latest - 48 * HOUR;
  rows = rows.filter(row => row.time >= start).sort((a, b) => a.time - b.time);
  const maxHeight = Math.max(1, ...rows.flatMap(row =>
    SERIES.map(({ heightKey }) => row[heightKey]).filter(Number.isFinite).map(value => height(value, units))));
  const targetStep = maxHeight * 1.04 / 4;
  const stepScale = 10 ** Math.floor(Math.log10(targetStep));
  const tickStep = [1, 1.5, 2, 2.5, 3, 5, 10].find(value => value * stepScale >= targetStep) * stepScale;

  const chartWidth = Math.max(225, Math.floor(width || container.clientWidth || 320));
  const left = 34, right = chartWidth - 14, top = 33, bottom = chartWidth < 480 ? 179 : 203;
  const x = time => left + (right - left) * (time - start) / (latest - start);
  const yTick = value => bottom - value / (4 * tickStep) * (bottom - top);
  const y = value => yTick(height(value, units));
  const chart = svg('svg', {
    viewBox: '0 0 ' + chartWidth + ' ' + (bottom + 49),
    class: 'week-chart comparison-chart',
    role: 'img',
    'aria-label': 'Hourly model and measured significant wave height, in ' + unit + ', at ' + station.name,
    'aria-describedby': 'buoy-comparison-note',
  });
  const axis = (xx, yy, label, anchor = 'start') =>
    svg('text', { x: xx, y: yy, 'text-anchor': anchor, class: 'week-axis-label comparison-axis' }, label);
  chart.append(axis(9, 20, 'Height (' + unit + ')'));
  for (let tick = 0; tick <= 4; tick++) {
    const value = tick * tickStep;
    const yy = yTick(value);
    chart.append(
      svg('line', { x1: left, x2: right, y1: yy, y2: yy, class: 'week-grid' }),
      axis(left - 7, yy + 4, tickHeight.format(value), 'end'),
    );
  }
  const timeTicks = chartWidth < 440 ? 2 : chartWidth < 690 ? 4 : 8;
  for (let tick = 0; tick <= timeTicks; tick++) {
    const time = start + (latest - start) * tick / timeTicks;
    const xx = x(time);
    const anchor = tick === 0 ? 'start' : tick === timeTicks ? 'end' : 'middle';
    chart.append(
      svg('line', { x1: xx, x2: xx, y1: top, y2: bottom, class: 'week-grid' }),
      axis(xx, bottom + 18, localDate.format(time), anchor),
      axis(xx, bottom + 34, localHour.format(time), anchor),
    );
  }

  const selected = svg('g', { 'aria-hidden': 'true' });
  const cursor = svg('line', { y1: top, y2: bottom, class: 'comparison-cursor' });
  const markers = SERIES.map(series => {
    const marker = comparisonSeries(chart, series, rows, x, y);
    marker.classList.add('comparison-' + series.name);
    return marker;
  });
  selected.append(cursor, ...markers);
  chart.append(selected);

  const readout = element('div', 'comparison-readout');
  const valid = element('div', 'comparison-valid');
  const model = element('div', 'comparison-reading comparison-model');
  const observed = element('div', 'comparison-reading comparison-observed');
  const slider = element('input');
  slider.type = 'range';
  slider.id = 'buoy-comparison-hour';
  slider.min = 0;
  slider.max = rows.length - 1;
  slider.disabled = rows.length < 2;
  const sliderLabel = element('label', '', 'Inspect comparison hour');
  sliderLabel.htmlFor = slider.id;
  const inspector = element('div', 'comparison-inspector');
  inspector.append(sliderLabel, slider, readout);
  readout.append(valid, model, observed);

  function inspect(index) {
    const row = rows[index];
    const cx = x(row.time);
    cursor.setAttribute('x1', cx);
    cursor.setAttribute('x2', cx);
    SERIES.forEach(({ heightKey }, markerIndex) => {
      const marker = markers[markerIndex];
      const value = row[heightKey];
      marker.setAttribute('visibility', Number.isFinite(value) ? 'visible' : 'hidden');
      if (!Number.isFinite(value)) return;
      marker.setAttribute('cx', cx);
      marker.setAttribute('cy', y(value));
    });
    const matches = Number.isFinite(row.observedHeight);
    const modelValue = Number.isFinite(row.modelHeight) ? size(row.modelHeight) : 'Estimate unavailable';
    const observedValue = matches ? size(row.observedHeight) : 'No reading within 15 min';
    valid.replaceChildren(element('span', 'comparison-reading-label', 'Model valid time'), timeElement(row.time, localTime));
    model.replaceChildren(element('span', 'comparison-reading-label', modelSource), element('strong', '', modelValue));
    observed.replaceChildren(element('span', 'comparison-reading-label', observedSource), element('strong', '', observedValue));
    const hasObservedTime = Number.isFinite(row.observedTime);
    if (matches && hasObservedTime) observed.append(timeElement(row.observedTime, localTime));
    slider.value = index;
    slider.dataset.selectedTime = row.time;
    slider.setAttribute('aria-valuetext', [
      localTime.format(row.time), modelSource + ' ' + modelValue, observedSource + ' ' + observedValue,
      matches && hasObservedTime ? localTime.format(row.observedTime) : '',
    ].filter(Boolean).join(', '));
  }

  function inspectPointer(event) {
    const bounds = chart.getBoundingClientRect();
    if (!bounds.width) return;
    const point = (event.clientX - bounds.left) / bounds.width * chartWidth;
    const visibleTime = start + (point - left) / (right - left) * (latest - start);
    inspect(rows.reduce((best, row, index) =>
      Math.abs(row.time - visibleTime) < Math.abs(rows[best].time - visibleTime) ? index : best, 0));
  }

  slider.addEventListener('input', () => inspect(Number(slider.value)));
  chart.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse') inspectPointer(event);
  });
  chart.addEventListener('click', inspectPointer);
  const existingIndex = rows.findIndex(row => row.time === priorTime);
  const lastPair = rows.findLastIndex(row => Number.isFinite(row.modelHeight) && Number.isFinite(row.observedHeight));
  inspect(existingIndex >= 0 ? existingIndex : lastPair >= 0 ? lastPair : rows.length - 1);

  const note = element('p', 'comparison-note',
    'Times are local to the selected beach. Each model hour uses the nearest buoy reading within 15 minutes. Gaps in the observation line mark hours with no match.');
  note.id = 'buoy-comparison-note';
  container.append(legend, chart, inspector, note);
  if (restoreFocus) slider.focus({ preventScroll: true });
}
