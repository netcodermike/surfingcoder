import { tideAt } from './src/tides.js';

export const tideColor = '#78c7ff';
export const windColor = '#f2c486';

function panel(root, name, title) {
  const section = document.createElement('section');
  section.className = 'week-support';
  section.id = 'week-' + name;
  const heading = document.createElement('h4');
  heading.id = section.id + '-title';
  heading.textContent = title;
  section.setAttribute('aria-labelledby', heading.id);
  const caption = document.createElement('p');
  section.append(heading, caption);
  root.append(section);
  return { section, caption };
}

function seriesChart({ values, unit, color, gap, label, arrows }, timeline) {
  const { svg, width, left, right, x, dayMarks, shadeDaylight, axisFont, compact } = timeline;
  const top = arrows ? 28 : 12;
  const bottom = 119;
  const graph = svg('svg', {
    viewBox: `0 0 ${width} 147`, role: 'img', 'aria-label': label, class: 'week-support-chart',
  });
  shadeDaylight(graph, top, bottom);
  const data = values.map(sample => sample.value).filter(Number.isFinite);
  const min = Math.min(0, ...data);
  const max = Math.max(0, ...data);
  const rawStep = (max - min || 1) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map(multiplier => multiplier * magnitude).find(value => value >= rawStep);
  const lowTick = Math.floor(min / step);
  const highTick = Math.max(1, Math.ceil(max / step));
  const y = value => bottom - (value / step - lowTick) / (highTick - lowTick) * (bottom - top);

  for (let i = lowTick; i <= highTick; i++) {
    const height = y(i * step);
    graph.append(svg('line', { x1: left, x2: right, y1: height, y2: height, class: i ? 'week-grid' : 'week-grid week-zero' }),
      svg('text', { x: 5, y: height + 4, 'font-size': axisFont, class: 'week-axis-label' },
        Number((i * step).toPrecision(4)) + unit));
  }
  dayMarks(graph, top, bottom, 138);

  let trace = '', fill = '', previous;
  function finishFill() {
    if (previous) fill += `L${x(previous.time).toFixed(2)},${bottom}Z`;
    previous = undefined;
  }
  for (const sample of values) {
    if (!Number.isFinite(sample.value) || (previous && sample.time - previous.time > gap)) finishFill();
    if (!Number.isFinite(sample.value)) continue;
    const xx = x(sample.time).toFixed(2);
    const point = `${xx},${y(sample.value).toFixed(2)}`;
    trace += (previous ? 'L' : 'M') + point;
    fill += previous ? 'L' + point : `M${xx},${bottom}L${point}`;
    previous = sample;
  }
  finishFill();
  graph.append(svg('path', { d: fill, fill: color, 'fill-opacity': '.19' }),
    svg('path', { d: trace, fill: 'none', stroke: color, 'stroke-width': '2', 'stroke-linejoin': 'round' }));

  if (arrows) {
    const marks = svg('g', { 'aria-hidden': 'true', fill: 'none', stroke: color, class: 'week-wind-arrows' });
    let lastX = -Infinity;
    for (const row of arrows) {
      const xx = x(row.time);
      if (row.speed <= 0 || !Number.isFinite(row.speed) || !Number.isFinite(row.wind_direction) || xx - lastX < (compact ? 26 : 38)) continue;
      marks.append(svg('path', {
        d: 'M0 6V-6 M-3.5 -2.5L0 -6L3.5 -2.5',
        transform: `translate(${xx} 14) rotate(${row.wind_direction + 180})`,
      }));
      lastX = xx;
    }
    graph.append(marks);
  }
  const point = svg('circle', { r: 4, fill: color, class: 'week-support-point' });
  return { graph, top, bottom, point, y };
}

export function tidePanel(root, tide, timeline, { units, heightUnit, scale }) {
  const { section, caption } = panel(root, 'tides', 'Tide predictions');
  if (!tide?.samples) {
    caption.textContent = tide?.message ?? 'Loading NOAA tide predictions…';
    return null;
  }
  const { station, samples } = tide;
  const stationLink = document.createElement('a');
  stationLink.href = 'https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=' + encodeURIComponent(station.id);
  stationLink.textContent = 'NOAA ' + (station.id === '8656590' ? 'Atlantic Beach Triple S Pier' : station.name);
  const distance = units === 'imperial' ? Math.round(station.distance * .621371) + ' mi' : Math.round(station.distance) + ' km';
  caption.append(stationLink, ` · ${distance} away · Mean Lower Low Water (MLLW)`);

  const { start, end } = timeline;
  const reading = row => {
    const value = tideAt(samples, row.time);
    return Number.isFinite(value) ? value * scale : null;
  };
  const values = [
    { time: start, value: reading({ time: start }) },
    ...samples.filter(row => row.time > start && row.time < end)
      .map(row => ({ time: row.time, value: row.value * scale })),
    { time: end, value: reading({ time: end }) },
  ];
  const chart = seriesChart({ values, unit: heightUnit, color: tideColor, gap: 360,
    label: 'Seven-day NOAA tide height in ' + heightUnit.trim() + ' relative to Mean Lower Low Water.' }, timeline);
  return { section, ...chart, reading };
}

export function windPanel(root, rows, timeline, { speedUnit, speedScale }) {
  const { section, caption } = panel(root, 'wind', 'Wind forecast');
  const reading = row => Number.isFinite(row.speed) ? row.speed * speedScale : null;
  const values = rows.map(row => ({ time: row.time, value: reading(row) }));
  if (!values.some(row => Number.isFinite(row.value))) {
    caption.textContent = 'Wind forecast unavailable for this location.';
    return null;
  }
  caption.textContent = '10 m wind speed · Arrows point downwind';
  const chart = seriesChart({ values, unit: speedUnit, color: windColor, gap: 3600, arrows: rows,
    label: 'Seven-day wind speed in ' + speedUnit.trim() + '. Arrows show the direction the wind is blowing toward.' }, timeline);
  return { section, ...chart, reading };
}
