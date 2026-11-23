import { tideAt } from './src/tides.js';
import { appendMarkerCheckbox, createChartArrows, DIRECTION_INTERVAL_SECONDS, hasDirection } from './src/chart-markers.js?v=20261123-observed-daylight';

export const tideColor = 'var(--surf-tide, #46b4ba)';
export const windColor = 'var(--surf-wind, #e7e9ee)';
export const temperatureColor = 'var(--surf-temperature, #62e6bd)';
export const rainColor = 'var(--surf-rain, #6290ff)';

export function seriesLegend(series, enabled, onChange, title) {
  const legend = document.createElement('div');
  legend.className = 'week-legend';
  legend.setAttribute('role', 'group');
  legend.setAttribute('aria-label', title);
  for (const item of series) {
    const label = document.createElement('label');
    const check = document.createElement('input');
    const swatch = document.createElement('i');
    check.type = 'checkbox';
    check.id = 'week-show-' + item.key;
    check.checked = item.available && enabled.has(item.key);
    check.disabled = !item.available;
    check.setAttribute('aria-label', item.name);
    check.onchange = () => onChange(item.key, check.checked);
    swatch.setAttribute('aria-hidden', 'true');
    swatch.style.background = item.dash
      ? `repeating-linear-gradient(to right, ${item.color} 0 6px, transparent 6px 9px)`
      : item.color;
    if (item.hint) label.title = item.hint;
    label.append(check, swatch, item.name + (item.available ? '' : ' · unavailable'));
    legend.append(label);
  }
  return legend;
}

function panel(root, name, title, entries, enabled, onChange) {
  const section = document.createElement('section');
  section.className = 'week-support';
  section.id = 'week-' + name;
  section.setAttribute('aria-label', title);
  section.append(seriesLegend(entries, enabled, onChange, title + ' layers'));
  root.append(section);
  return section;
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
  const { svg, width, left, right, x, start, firstForecastHour, dayMarks, shadeDaylight, axisFont, compact } = timeline;
  // Leave room above the plot and before the date labels for the wind arrows.
  const top = arrows ? 16 : 12;
  const bottom = 119;
  const height = arrows ? 138 : 130;
  const dateAxis = arrows ? { height: 157, labelY: 151 } : { height: 147, labelY: 138 };
  const graph = svg('svg', {
    viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label, class: 'week-support-chart',
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
  dayMarks(graph, top, bottom);

  const markers = [];
  if (primaryScale) markers.push(drawSeries(graph, primary, timeline, primaryScale.y, bottom));
  if (secondaryScale) markers.push(drawSeries(graph, secondary, timeline, secondaryScale.y, bottom));

  if (arrows) {
    const interval = DIRECTION_INTERVAL_SECONDS;
    const arrowsOnWind = createChartArrows(svg, {
      className: 'week-wind-arrows', color: windColor, spacing: x(start + interval) - x(start),
    });
    for (const row of arrows) {
      if ((row.time - firstForecastHour) % interval !== 0 || !Number.isFinite(row.speed) || row.speed <= 0) continue;
      arrowsOnWind.add(x(row.time), secondaryScale.y(secondary.reading(row)), row.wind_direction);
    }
    graph.append(arrowsOnWind.group);
  }
  return { graph, top, bottom, markers, dateAxis };
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

export function tideWindPanel(root, rows, tide, timeline, metrics, enabled, onChange) {
  const { heightUnit, scale, speedUnit, speedScale } = metrics;
  const wind = hourlySeries(rows, row => Number.isFinite(row.speed) ? row.speed * speedScale : null,
    { unit: speedUnit, color: windColor });
  const tidal = tide?.samples ? tideSeries(tide.samples, timeline, heightUnit, scale) : null;
  const section = panel(root, 'tides', 'Tide and wind', [
    { key: 'tide', name: 'Tide', color: tideColor, available: Boolean(tidal),
      hint: tidal ? 'NOAA predictions relative to Mean Lower Low Water' :
        tide?.message ?? (tide?.samples ? 'NOAA tide predictions unavailable' : 'Loading NOAA tide predictions') },
    { key: 'wind', name: 'Wind speed', color: windColor, available: Boolean(wind) },
  ], enabled, onChange);
  const arrowKey = 'wind-direction-arrows';
  const hasWindDirection = wind && rows.some(row =>
    (row.time - timeline.firstForecastHour) % DIRECTION_INTERVAL_SECONDS === 0 &&
    Number.isFinite(row.speed) && row.speed > 0 && hasDirection(row.wind_direction));
  if (hasWindDirection) appendMarkerCheckbox(section.firstElementChild, {
    id: 'week-show-' + arrowKey, label: 'Direction arrows',
    checked: enabled.has(arrowKey), onChange: checked => onChange(arrowKey, checked),
  });
  if (!tidal && !wind) return null;
  const visibleTide = enabled.has('tide') ? tidal : null;
  const visibleWind = enabled.has('wind') ? wind : null;
  const descriptions = [timeline.duration + ' tide and wind forecast.'];
  if (visibleTide) descriptions.push('NOAA tide height in ' + heightUnit.trim() + ' relative to Mean Lower Low Water on the left axis.');
  const showWindArrows = visibleWind && hasWindDirection && enabled.has(arrowKey);
  if (visibleWind) descriptions.push('Wind speed in ' + speedUnit.trim() + ' on the right axis.');
  if (showWindArrows) descriptions.push('Arrows point downwind at two-hour intervals.');
  const chart = seriesChart(visibleTide, timeline, {
    secondary: visibleWind, arrows: showWindArrows ? rows : null, label: descriptions.join(' '),
  });
  return { section, ...chart, tideReading: visibleTide?.reading, windReading: visibleWind?.reading };
}

export function weatherPanel(root, rows, timeline, enabled, onChange) {
  const temperature = hourlySeries(rows, row => row.airTemperatureF,
    { unit: ' °F', color: temperatureColor, includeZero: false });
  const rain = hourlySeries(rows, row => Number.isFinite(row.rainChance) && row.rainChance >= 0 && row.rainChance <= 100 ? row.rainChance : null,
    { unit: '%', color: rainColor, ticks: [0, 25, 50, 75, 100] });
  const section = panel(root, 'weather', 'Air temperature and rain chance', [
    { key: 'temperature', name: 'Air temperature (°F)', color: temperatureColor, available: Boolean(temperature) },
    { key: 'rain', name: 'Rain chance (%)', color: rainColor, available: Boolean(rain),
      hint: 'Chance of measurable precipitation in the hour ending at the forecast time' },
  ], enabled, onChange);
  if (!temperature && !rain) return null;
  const visibleTemperature = enabled.has('temperature') ? temperature : null;
  const visibleRain = enabled.has('rain') ? rain : null;
  const descriptions = [timeline.duration + ' air temperature and rain chance.'];
  if (visibleTemperature) descriptions.push('Air temperature in degrees Fahrenheit on the left axis.');
  if (visibleRain) descriptions.push('Hourly chance of precipitation on the right axis, from 0 to 100 percent.');
  const chart = seriesChart(visibleTemperature, timeline, { secondary: visibleRain, label: descriptions.join(' ') });
  return { section, ...chart, temperatureReading: visibleTemperature?.reading, rainReading: visibleRain?.reading };
}
