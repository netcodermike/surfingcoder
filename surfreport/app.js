import { setupBuoyView } from './src/buoys.js?v=20261124-five-days';
import { weekly } from './weekly.js?v=20261124-five-days';
import { MAX_RANGE_DAYS } from './src/chart-ranges.js?v=20261124-five-days';
import { $, field, select, button, on, download } from './ui.js?v=20261124-review';
import * as core from './src/core.js?v=20261124-review';
import { loadTides } from './src/tides.js?v=20261124-review';

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
  button('Use custom coordinates', 'custom') + '</div></details>' +
  '<p id="control-status" class="status" role="status"></p>';

const buoyView = setupBuoyView(() => $('units').value);
let rows = [];
let visibleRows = [];
let zone = 'UTC';
let active;
let controller;
let tide;
let daylight;
let forecastTime;
let forecastMessage = '';
let weatherMessage = '';
let chosenForecastDays;
const narrowForecast = matchMedia('(max-width: 600px)');
const currentTime = () => Math.floor(Date.now() / 1000);
$('csv').disabled = true;

function showForecastStatus() {
  $('status').textContent = [forecastMessage, weatherMessage, tide?.message].filter(Boolean).join(' ');
}

function locationTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) return 'UTC';
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

const value = (number, suffix = '') => Number.isFinite(number) ? number.toFixed(1) + suffix : '—';

function drawWeek() {
  const days = chosenForecastDays ?? (narrowForecast.matches ? 2 : MAX_RANGE_DAYS);
  return weekly(rows, {
    zone, units: $('units').value, tide, daylight, location: active?.label, days, now: forecastTime,
    onRangeChange: next => {
      chosenForecastDays = next;
      draw();
    },
  });
}

function renderHourly(visibleRows, timeFormat, units, heightUnit, speedUnit, speedFactor) {
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
  for (const row of visibleRows) {
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
  const output = $('output');
  const { scrollTop, scrollLeft } = output;
  output.replaceChildren(table);
  output.scrollTop = scrollTop;
  output.scrollLeft = scrollLeft;
  $('hourly').hidden = false;
}

function draw() {
  visibleRows = drawWeek();
  $('csv').disabled = !visibleRows.length;
  if (rows.length && !visibleRows.length) {
    forecastMessage = 'This forecast has expired. Select Update forecast for a fresh report.';
    showForecastStatus();
  }
  if (!visibleRows.length) {
    $('output').replaceChildren();
    $('hourly').hidden = true;
    return;
  }
  const units = $('units').value;
  const imperial = units === 'imperial';
  const heightUnit = imperial ? ' ft' : ' m';
  const speedUnit = imperial ? ' mph' : ' km/h';
  const speedFactor = imperial ? .621371 : 1;
  const timeFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  renderHourly(visibleRows, timeFormat, units, heightUnit, speedUnit, speedFactor);
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
  showForecastStatus();
  const link = $('tide-source');
  if (tide.station) {
    link.href = 'https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=' + encodeURIComponent(tide.station.id);
    link.textContent = 'NOAA tide predictions · ' + tide.station.name + ' · MLLW';
    link.hidden = false;
  }
}

async function forecastData(endpoint, params, request) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20000)]);
  const response = await fetch(endpoint + '?' + params, { signal });
  const data = await response.json();
  if (!response.ok) throw Error(data.reason || 'The data provider returned HTTP ' + response.status + '.');
  return data;
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
  $('tide-source').hidden = true;
  forecastMessage = 'Loading the marine forecast…';
  weatherMessage = '';
  showForecastStatus();
  draw();
  const common = new URLSearchParams({
    latitude: coords.lat, longitude: coords.lon, timezone: 'auto', timeformat: 'unixtime',
    forecast_days: MAX_RANGE_DAYS + 1,
  });
  const weatherParams = new URLSearchParams(common);
  weatherParams.set('hourly', 'wind_speed_10m,wind_direction_10m,temperature_2m,precipitation_probability');
  weatherParams.set('temperature_unit', 'fahrenheit');
  weatherParams.set('daily', 'sunrise,sunset');
  const weather = forecastData('https://api.open-meteo.com/v1/forecast', weatherParams, request).catch(() => null);
  try {
    const marineParams = new URLSearchParams(common);
    marineParams.set('cell_selection', 'sea');
    marineParams.set('hourly', marineFields);
    const marine = await forecastData('https://marine-api.open-meteo.com/v1/marine', marineParams, request);
    if (request !== controller) return;
    zone = locationTimeZone(marine.timezone);
    buoyView.setTimeZone(zone);
    rows = core.align(marine);
    forecastTime = currentTime();
    forecastMessage = '';
    draw();
    showForecastStatus();
    void updateTides(active, request, rows[0].time, rows.at(-1).time);

    const weatherData = await weather;
    if (request !== controller) return;
    daylight = weatherData?.daily;
    rows = core.align(marine, weatherData);
    if (!rows.some(row => [row.speed, row.airTemperatureF, row.rainChance].some(Number.isFinite))) {
      weatherMessage = 'Local wind, temperature and rain forecasts are currently unavailable.';
    }
    draw();
    showForecastStatus();
  } catch (error) {
    if (request !== controller) return;
    request.abort();
    forecastMessage = 'Could not load the marine forecast. ' + (error.name === 'TimeoutError' ? 'Request timed out.' : error.message);
    showForecastStatus();
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
  $('control-status').textContent = '';
  $('spot').querySelector('option[value="custom"]')?.remove();
  const [label, lat, lon] = core.regions[$('region').value][Number($('spot').value)];
  $('lat').value = lat;
  $('lon').value = lon;
  return load(lat, lon, label);
}

function useCustomPoint(lat, lon, label) {
  const spots = $('spot');
  if (!spots.querySelector('option[value="custom"]')) spots.add(new Option('Custom coordinates', 'custom'));
  spots.value = 'custom';
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
  return useCustomPoint(lat, lon, 'Custom coastal point ' + lat + ', ' + lon);
});
on('save', () => {
  if (!active) throw Error('Choose a location first');
  localStorage.setItem(storageKey, JSON.stringify(active));
  $('control-status').textContent = 'Saved on this device.';
});
on('csv', () => {
  if (!visibleRows.length) return;
  const csv = visibleRows.map(row => [
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
    useCustomPoint(lat, lon, String(saved.label || 'Saved coastal point'));
  }
} catch {
  choose();
}

let chartWidth;
narrowForecast.addEventListener('change', () => {
  if (chosenForecastDays === undefined) draw();
});
new ResizeObserver(([entry]) => {
  const width = entry.contentRect.width;
  if (!width || width === chartWidth) return;
  chartWidth = width;
  if (rows.length) drawWeek();
}).observe($('weekly'));

function advanceForecast() {
  const now = currentTime();
  if (document.hidden || !visibleRows.length || now <= visibleRows[0].time) return;
  forecastTime = now;
  draw();
}
setInterval(advanceForecast, 60000);
document.addEventListener('visibilitychange', advanceForecast);
