import { tideAt } from './src/tides.js';

export const tideColor = '#78c7ff';
export const windColor = '#f2c486';
export const temperatureColor = '#62e6bd';
const rainColor = '#a3adff';

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

function seriesKey(text, color) {
  const key = document.createElement('span');
  key.className = 'week-series-key';
  key.style.setProperty('--series-color', color);
  key.textContent = text;
  return key;
}

function hourlySeries(rows, reading, options) {
  const values = rows.map(row => ({ time: row.time, value: reading(row) }));
  return values.some(row => Number.isFinite(row.value)) ? { ...options, values, reading, gap: 3600 } : null;
}

function scaleFromTicks(ticks, top, bottom) {
  const min = ticks[0], max = ticks.at(-1);
  const y = value => bottom - (value - min) / (max - min) * (bottom - top);
  return { y, ticks };
}

function seriesScale({ values, includeZero = true, ticks }, top, bottom) {
  if (ticks) return scaleFromTicks(ticks, top, bottom);
  const data = values.map(sample => sample.value).filter(Number.isFinite);
  const min = includeZero ? Math.min(0, ...data) : Math.min(...data) - 1;
  const max = includeZero ? Math.max(0, ...data) : Math.max(...data) + 1;
  const rawStep = (max - min || 1) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map(multiplier => multiplier * magnitude).find(value => value >= rawStep);
  const lowTick = Math.floor(min / step);
  const highTick = Math.max(includeZero ? 1 : lowTick + 1, Math.ceil(max / step));
  const axisTicks = Array.from({ length: highTick - lowTick + 1 }, (_, i) => (i + lowTick) * step);
  return scaleFromTicks(axisTicks, top, bottom);
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

function seriesChart(primary, timeline, { label, arrows, secondary }) {
  const { svg, width, left, right, x, dayMarks, shadeDaylight, axisFont, compact } = timeline;
  const top = 12;
  const bottom = 119;
  const graph = svg('svg', {
    viewBox: `0 0 ${width} 147`, role: 'img', 'aria-label': label, class: 'week-support-chart',
  });
  shadeDaylight(graph, top, bottom);
  const primaryScale = primary && seriesScale(primary, top, bottom);
  const secondaryScale = secondary && seriesScale(secondary, top, bottom);

  function drawAxis(scale, { unit, color }, onRight) {
    for (const tick of scale.ticks) {
      const height = scale.y(tick);
      if (!onRight || !primaryScale) {
        graph.append(svg('line', { x1: left, x2: right, y1: height, y2: height, class: tick ? 'week-grid' : 'week-grid week-zero' }));
      } else {
        graph.append(svg('line', { x1: right, x2: right + 4, y1: height, y2: height, stroke: color }));
      }
      graph.append(svg('text', {
        x: onRight ? width - (compact ? 5 : 12) : 5, y: height + 4, 'font-size': axisFont,
        'text-anchor': onRight ? 'end' : 'start', fill: color,
        class: onRight ? 'week-right-axis-label' : 'week-left-axis-label',
      }, Number(tick.toPrecision(4)) + unit));
    }
  }
  if (primaryScale) drawAxis(primaryScale, primary, false);
  if (secondaryScale) drawAxis(secondaryScale, secondary, true);
  dayMarks(graph, top, bottom, 138);

  const markers = [];
  if (primaryScale) markers.push(drawSeries(graph, primary, timeline, primaryScale.y, bottom));
  if (secondaryScale) markers.push(drawSeries(graph, secondary, timeline, secondaryScale.y, bottom));

  if (arrows) {
    const marks = svg('g', { 'aria-hidden': 'true', fill: 'none', stroke: windColor, class: 'week-wind-arrows' });
    let lastX = -Infinity;
    for (const row of arrows) {
      const xx = x(row.time);
      if (row.speed <= 0 || !Number.isFinite(row.speed) || !Number.isFinite(row.wind_direction) || xx - lastX < (compact ? 26 : 38)) continue;
      marks.append(svg('path', {
        d: 'M0 0V-10 M-3.5 -6.5L0 -10L3.5 -6.5',
        transform: `translate(${xx} ${secondaryScale.y(secondary.reading(row))}) rotate(${row.wind_direction + 180})`,
      }));
      lastX = xx;
    }
    graph.append(marks);
  }
  return { graph, top, bottom, markers };
}

function tideSeries(samples, timeline, heightUnit, scale) {
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
  return values.some(row => Number.isFinite(row.value))
    ? { values, unit: heightUnit, color: tideColor, gap: 360, reading, filled: true } : null;
}

export function tideWindPanel(root, rows, tide, timeline, { units, heightUnit, scale, speedUnit, speedScale }) {
  const { section, caption } = panel(root, 'tides', 'Tide and wind');
  const wind = hourlySeries(rows, row => Number.isFinite(row.speed) ? row.speed * speedScale : null,
    { unit: speedUnit, color: windColor });
  const tidal = tide?.samples ? tideSeries(tide.samples, timeline, heightUnit, scale) : null;
  const descriptions = [];
  if (tidal) {
    const { station } = tide;
    const stationLink = document.createElement('a');
    stationLink.href = 'https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=' + encodeURIComponent(station.id);
    stationLink.textContent = 'NOAA ' + (station.id === '8656590' ? 'Atlantic Beach Triple S Pier' : station.name);
    const distance = units === 'imperial' ? Math.round(station.distance * .621371) + ' mi' : Math.round(station.distance) + ' km';
    caption.append(seriesKey('Tide', tideColor), ' · ', stationLink, ` · ${distance} away · MLLW`);
    descriptions.push('NOAA tide height in ' + heightUnit.trim() + ' relative to Mean Lower Low Water on the left axis.');
  } else {
    caption.textContent = tide?.message ?? (tide?.samples ? 'NOAA tide predictions unavailable.' : 'Loading NOAA tide predictions…');
  }
  if (wind) {
    caption.append(' · ', seriesKey('Wind speed', windColor), ' · Arrows point downwind');
    descriptions.push('Wind speed in ' + speedUnit.trim() + ' on the right axis. Arrows point downwind.');
  } else {
    caption.append(' · Wind forecast unavailable');
  }
  if (!tidal && !wind) return null;
  const chart = seriesChart(tidal, timeline, { secondary: wind, arrows: wind ? rows : null, label: descriptions.join(' ') });
  return { section, ...chart, tideReading: tidal?.reading, windReading: wind?.reading };
}

export function weatherPanel(root, rows, timeline) {
  const { section, caption } = panel(root, 'weather', 'Air temperature and rain chance');
  const temperature = hourlySeries(rows, row => row.airTemperatureF,
    { unit: ' °F', color: temperatureColor, includeZero: false });
  const rain = hourlySeries(rows, row => Number.isFinite(row.rainChance) && row.rainChance >= 0 && row.rainChance <= 100 ? row.rainChance : null,
    { unit: '%', color: rainColor, ticks: [0, 25, 50, 75, 100] });
  const descriptions = [];
  if (temperature) {
    caption.append(seriesKey('Air temperature (°F)', temperatureColor));
    descriptions.push('Air temperature in degrees Fahrenheit on the left axis.');
  }
  if (rain) {
    const rainKey = seriesKey('Rain chance (%)', rainColor);
    rainKey.title = 'Chance of measurable precipitation in the hour ending at the forecast time';
    if (temperature) caption.append(' · ');
    caption.append(rainKey);
    descriptions.push('Hourly chance of precipitation on the right axis, from 0 to 100 percent.');
  } else if (temperature) {
    caption.append(' · Rain chance unavailable');
  }
  if (!temperature && !rain) {
    caption.textContent = 'Air temperature and rain chance are unavailable for this location.';
    return null;
  }
  const chart = seriesChart(temperature, timeline, { secondary: rain, label: descriptions.join(' ') });
  return { section, ...chart, temperatureReading: temperature?.reading };
}
