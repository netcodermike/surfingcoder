import { tideAt } from './src/tides.js';

export const tideColor = '#78c7ff';
export const windColor = '#f2c486';
export const temperatureColor = '#62e6bd';

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

function seriesScale(values, top, bottom, includeZero) {
  const data = values.map(sample => sample.value).filter(Number.isFinite);
  const min = includeZero ? Math.min(0, ...data) : Math.min(...data) - 1;
  const max = includeZero ? Math.max(0, ...data) : Math.max(...data) + 1;
  const rawStep = (max - min || 1) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map(multiplier => multiplier * magnitude).find(value => value >= rawStep);
  const lowTick = Math.floor(min / step);
  const highTick = Math.max(includeZero ? 1 : lowTick + 1, Math.ceil(max / step));
  const y = value => bottom - (value / step - lowTick) / (highTick - lowTick) * (bottom - top);
  const ticks = Array.from({ length: highTick - lowTick + 1 }, (_, i) => (i + lowTick) * step);
  return { y, ticks };
}

function drawSeries(graph, { values, color, gap, reading, filled = false }, { svg, x }, y, bottom) {
  let trace = '', fill = '', previous;
  function finishFill() {
    if (previous && filled) fill += `L${x(previous.time).toFixed(2)},${bottom}Z`;
    previous = undefined;
  }
  for (const sample of values) {
    if (!Number.isFinite(sample.value) || (previous && sample.time - previous.time > gap)) finishFill();
    if (!Number.isFinite(sample.value)) continue;
    const xx = x(sample.time).toFixed(2);
    const point = `${xx},${y(sample.value).toFixed(2)}`;
    trace += (previous ? 'L' : 'M') + point;
    if (filled) fill += previous ? 'L' + point : `M${xx},${bottom}L${point}`;
    previous = sample;
  }
  finishFill();
  if (filled) graph.append(svg('path', { d: fill, fill: color, 'fill-opacity': '.19' }));
  graph.append(svg('path', { d: trace, fill: 'none', stroke: color, 'stroke-width': '2', 'stroke-linejoin': 'round' }));
  const point = svg('circle', { r: 4, fill: color, class: 'week-support-point' });
  return { point, reading, y };
}

function seriesChart(primary, timeline, { label, arrows, temperature } = {}) {
  const { svg, width, left, right, x, dayMarks, shadeDaylight, axisFont, compact } = timeline;
  const top = arrows ? 28 : 12;
  const bottom = 119;
  const graph = svg('svg', {
    viewBox: `0 0 ${width} 147`, role: 'img', 'aria-label': label, class: 'week-support-chart',
  });
  shadeDaylight(graph, top, bottom);
  const primaryScale = primary && seriesScale(primary.values, top, bottom, true);
  const tempScale = temperature && seriesScale(temperature.values, top, bottom, false);

  function drawAxis(scale, unit, onRight) {
    for (const tick of scale.ticks) {
      const height = scale.y(tick);
      if (!onRight || !primaryScale) {
        graph.append(svg('line', { x1: left, x2: right, y1: height, y2: height, class: tick ? 'week-grid' : 'week-grid week-zero' }));
      } else {
        graph.append(svg('line', { x1: right, x2: right + 4, y1: height, y2: height, stroke: temperatureColor }));
      }
      graph.append(svg('text', {
        x: onRight ? width - (compact ? 5 : 12) : 5, y: height + 4, 'font-size': axisFont,
        'text-anchor': onRight ? 'end' : 'start', class: onRight ? 'week-temperature-axis' : 'week-axis-label',
      }, Number(tick.toPrecision(4)) + unit));
    }
  }
  if (primaryScale) drawAxis(primaryScale, primary.unit, false);
  if (tempScale) drawAxis(tempScale, temperature.unit, true);
  dayMarks(graph, top, bottom, 138);

  const markers = [];
  if (primaryScale) markers.push(drawSeries(graph, primary, timeline, primaryScale.y, bottom));
  if (tempScale) markers.push(drawSeries(graph, temperature, timeline, tempScale.y, bottom));

  if (arrows) {
    const marks = svg('g', { 'aria-hidden': 'true', fill: 'none', stroke: windColor, class: 'week-wind-arrows' });
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
  return { graph, top, bottom, markers };
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
  const chart = seriesChart({ values, unit: heightUnit, color: tideColor, gap: 360, reading, filled: true }, timeline,
    { label: 'Seven-day NOAA tide height in ' + heightUnit.trim() + ' relative to Mean Lower Low Water.' });
  return { section, ...chart, reading };
}

export function windPanel(root, rows, timeline, { speedUnit, speedScale, hasTemperature }) {
  const reading = row => Number.isFinite(row.speed) ? row.speed * speedScale : null;
  const values = rows.map(row => ({ time: row.time, value: reading(row) }));
  const hasWind = values.some(row => Number.isFinite(row.value));
  const title = hasTemperature ? (hasWind ? 'Wind and air temperature' : 'Air temperature') : 'Wind forecast';
  const { section, caption } = panel(root, 'wind', title);
  if (!hasWind && !hasTemperature) {
    caption.textContent = 'Wind forecast unavailable for this location.';
    return null;
  }
  const wind = hasWind ? { values, unit: speedUnit, color: windColor, gap: 3600, reading } : null;
  const temperature = hasTemperature ? {
    values: rows.map(row => ({ time: row.time, value: row.airTemperatureF })),
    unit: ' °F', color: temperatureColor, gap: 3600, reading: row => row.airTemperatureF,
  } : null;
  const descriptions = [];
  if (hasWind) {
    caption.append('10 m wind speed · Arrows point downwind');
    descriptions.push('Seven-day wind speed in ' + speedUnit.trim() + ' on the left axis. Arrows point downwind.');
  }
  if (temperature) {
    section.style.setProperty('--air-temperature-color', temperatureColor);
    const legend = document.createElement('span');
    legend.className = 'week-temperature-key';
    legend.textContent = 'Air temperature (°F)';
    if (hasWind) caption.append(' · ');
    caption.append(legend);
    descriptions.push('Mint green line shows air temperature in degrees Fahrenheit on the right axis.');
  }
  const chart = seriesChart(wind, timeline, { label: descriptions.join(' '), arrows: hasWind ? rows : null, temperature });
  return { section, ...chart, reading: hasWind ? reading : null };
}
