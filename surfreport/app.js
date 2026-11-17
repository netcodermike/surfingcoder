import { setupBuoyView } from './src/buoys.js?v=20261117-buoy-observations';
import { weekly } from './weekly.js?v=20261117-wind-waves';
import { $, field, select, button, on, download } from './ui.js';
import * as core from './src/core.js?v=20261117-tides-wind';
import { loadTides } from './src/tides.js';

const defaultLocation = 'Indian Beach, NC';
const [, defaultLat, defaultLon] = core.presetForLabel(defaultLocation).point;
const storageKey = 'surfcoder-surf-location';

$('controls').innerHTML =
  '<div class="location-fields">' +
  '<div>' + select('Your region', 'region', Object.keys(core.regions)) + '</div>' +
  '<div>' + select('Forecast location', 'spot', []) + '</div>' +
  '<div>' + select('Display units', 'units', [['imperial', 'Feet · mph'], ['metric', 'Metres · km/h']]) + '</div>' +
  '</div><div class="location-actions">' +
  button('Update forecast', 'refresh') + button('Save this location', 'save') + button('Download forecast CSV', 'csv') +
  '</div><details class="coordinate-controls"><summary>Custom coordinates</summary><div class="coordinate-fields">' +
  '<div>' + field('Latitude', 'lat', 'number', defaultLat, 'step=".0001" min="-85" max="85"') + '</div>' +
  '<div>' + field('Longitude', 'lon', 'number', defaultLon, 'step=".0001" min="-180" max="180"') + '</div>' +
  button('Use custom coordinates', 'custom') + '</div></details>';

const buoyView = setupBuoyView(() => $('units').value);
let rows = [];
let zone = 'UTC';
let active;
let controller;
let tide;
let daylight;

const value = (number, suffix = '') => Number.isFinite(number) ? number.toFixed(1) + suffix : '—';

function drawWeek() {
  weekly(rows, { zone, units: $('units').value, tide, daylight });
}

function renderHourly(timeFormat, units, heightUnit, speedUnit, speedFactor) {
  const table = document.createElement('table');
  const headings = table.createTHead().insertRow();
  for (const title of ['Time', 'Waves' + heightUnit, 'Period', 'Swell' + heightUnit, 'Wave from', 'Wind' + speedUnit, 'Wind from']) {
    const header = document.createElement('th');
    header.scope = 'col';
    header.textContent = title;
    if (title === 'Time') header.setAttribute('aria-sort', 'ascending');
    headings.append(header);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    const date = new Date(row.time * 1000);
    const stamp = document.createElement('time');
    stamp.dateTime = date.toISOString();
    stamp.textContent = timeFormat.format(date);
    tr.insertCell().append(stamp);
    const fields = [
      value(core.height(row.wave, units)),
      value(row.period, ' s'),
      value(core.height(row.swell, units)),
      core.compass(row.direction),
      value(Number.isFinite(row.speed) ? row.speed * speedFactor : null),
      core.compass(row.wind_direction),
    ];
    for (const field of fields) tr.insertCell().textContent = field;
  }
  $('output').replaceChildren(table);
  $('output').scrollTop = 0;
  $('hourly').hidden = false;
}

function draw() {
  if (!rows.length) return;
  const units = $('units').value;
  const imperial = units === 'imperial';
  const heightUnit = imperial ? ' ft' : ' m';
  const speedUnit = imperial ? ' mph' : ' km/h';
  const speedFactor = imperial ? .621371 : 1;
  const current = rows.find(row => row.time >= Date.now() / 1000) ?? rows.at(-1);
  $('metric').textContent = value(core.height(current.wave, units), heightUnit);
  const summary = $('summary');
  summary.replaceChildren();
  for (const [name, reading] of [
    ['Wave period', value(current.period, ' s')],
    ['Swell period', value(current.swellPeriod, ' s')],
    ['Wave from', core.compass(current.direction)],
    ['Wind', value(Number.isFinite(current.speed) ? current.speed * speedFactor : null, speedUnit)],
  ]) {
    const chip = document.createElement('div');
    chip.className = 'chip';
    const metric = document.createElement('b');
    metric.textContent = reading;
    chip.append(metric, name);
    summary.append(chip);
  }
  const timeFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  drawWeek();
  renderHourly(timeFormat, units, heightUnit, speedUnit, speedFactor);
}

const marineFields = [
  'wave_height', 'wave_period', 'wave_direction',
  'swell_wave_height', 'swell_wave_period', 'swell_wave_direction',
  'secondary_swell_wave_height', 'secondary_swell_wave_period', 'secondary_swell_wave_direction',
  'tertiary_swell_wave_height', 'tertiary_swell_wave_period', 'tertiary_swell_wave_direction',
  'wind_wave_height', 'wind_wave_period', 'wind_wave_direction',
].join(',');

async function updateTides(location, request, start, end) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)]);
  let result;
  try {
    result = await loadTides(location, start, end, signal) ??
      { message: 'No NOAA tide prediction station within 80 km (50 mi).' };
  } catch {
    result = { message: 'NOAA tide predictions are currently unavailable.' };
  }
  if (request !== controller) return;
  tide = result;
  drawWeek();
}

async function load(lat, lon, label) {
  const coords = core.coordinates(lat, lon);
  active = { ...coords, label };
  buoyView.setLocation(active);
  controller?.abort();
  const request = new AbortController();
  controller = request;
  rows = [];
  tide = undefined;
  daylight = undefined;
  $('summary').replaceChildren();
  $('output').replaceChildren();
  $('hourly').hidden = true;
  $('metric').textContent = '…';
  $('result-title').textContent = label;
  $('status').textContent = 'Requesting the seven-day forecast…';
  drawWeek();
  const timeout = setTimeout(() => request.abort(), 20000);
  try {
    const common = 'latitude=' + coords.lat + '&longitude=' + coords.lon + '&timezone=auto&timeformat=unixtime&forecast_days=7';
    const signals = { signal: request.signal };
    const [marine, weather] = await Promise.allSettled([
      fetch('https://marine-api.open-meteo.com/v1/marine?' + common + '&cell_selection=sea&hourly=' + marineFields, signals).then(async response => {
        const data = await response.json();
        if (!response.ok) throw Error(data.reason || 'Marine request failed');
        return data;
      }),
      fetch('https://api.open-meteo.com/v1/forecast?' + common + '&hourly=wind_speed_10m,wind_direction_10m&daily=sunrise,sunset', signals).then(response => {
        if (!response.ok) throw Error('Wind request failed');
        return response.json();
      }),
    ]);
    if (request !== controller) return;
    if (marine.status !== 'fulfilled') throw marine.reason;
    zone = marine.value.timezone || 'UTC';
    const weatherData = weather.status === 'fulfilled' ? weather.value : null;
    daylight = weatherData?.daily;
    rows = core.align(marine.value, weatherData).sort((a, b) => a.time - b.time);
    draw();
    $('status').textContent = '';
    updateTides(active, request, rows[0].time, rows.at(-1).time);
  } catch (error) {
    if (request !== controller) return;
    $('metric').textContent = 'Unavailable';
    $('status').textContent = 'Could not load the forecast. ' + (error.name === 'AbortError' ? 'Request timed out.' : error.message);
  } finally {
    clearTimeout(timeout);
  }
}

function populateSpots() {
  const selector = $('spot');
  selector.replaceChildren();
  const region = $('region').value;
  if (region !== 'North Carolina') {
    core.regions[region].forEach(([name], i) => selector.append(new Option(name, i)));
    return;
  }
  const groups = new Map();
  core.ncBeaches.forEach((beach, i) => {
    if (!groups.has(beach.area)) {
      const group = document.createElement('optgroup');
      group.label = beach.area;
      groups.set(beach.area, group);
      selector.append(group);
    }
    groups.get(beach.area).append(new Option(beach.name, i));
  });
}

function choose() {
  const [label, lat, lon] = core.regions[$('region').value][Number($('spot').value)];
  $('lat').value = lat;
  $('lon').value = lon;
  return load(lat, lon, label);
}

function selectPreset(label) {
  const preset = core.presetForLabel(label);
  if (!preset) return false;
  $('region').value = preset.region;
  populateSpots();
  $('spot').value = preset.index;
  return true;
}

$('region').onchange = () => { populateSpots(); choose(); };
$('spot').onchange = choose;
$('units').onchange = () => { draw(); buoyView.updateUnits(); };
on('refresh', () => active ? load(active.lat, active.lon, active.label) : choose());
on('custom', () => {
  if (!$('lat').value.trim() || !$('lon').value.trim()) throw Error('Enter both coordinates');
  const { lat, lon } = core.coordinates($('lat').value, $('lon').value);
  return load(lat, lon, 'Custom coastal point ' + lat + ', ' + lon);
});
on('save', () => {
  if (!active) throw Error('Choose a location first');
  localStorage.setItem(storageKey, JSON.stringify(active));
  $('status').textContent = 'Saved on this device.';
});
on('csv', () => {
  if (!rows.length) throw Error('Load a forecast first');
  const csv = rows.map(row => [
    new Date(row.time * 1000).toISOString(), row.wave ?? '', row.period ?? '',
    row.swell ?? '', row.speed ?? '', row.wind_direction ?? '',
  ].join(',')).join('\n');
  download('surf-forecast.csv', 'time_utc,wave_m,period_s,swell_m,wind_kmh,wind_from_degrees\n' + csv, 'text/csv');
});

selectPreset(defaultLocation);
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (!saved || saved.label === 'Outer Banks, NC' || selectPreset(saved.label)) {
    choose();
  } else {
    const { lat, lon } = core.coordinates(saved.lat, saved.lon);
    $('lat').value = lat;
    $('lon').value = lon;
    load(lat, lon, String(saved.label || 'Saved coastal point'));
  }
} catch {
  choose();
}

let chartWidth;
new ResizeObserver(([entry]) => {
  const width = entry.contentRect.width;
  if (!width || width === chartWidth) return;
  chartWidth = width;
  if (rows.length) drawWeek();
}).observe($('weekly'));
