import { compass, distanceKm, height } from './core.js?v=20261117-tides-wind';
import { drawBuoyChart } from './buoy-chart.js';

const RADIUS_KM = 250;
const NDBC = 'https://www.ndbc.noaa.gov';
const COASTWATCH = 'https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet';
const ONSLOW_DATASET = 'https://erddap.secoora.org/erddap/tabledap/41159-lej3wave-lej3w-onslow-b';
const fields = ['station', 'time', 'WVHT', 'DPD', 'MWD', 'WTMP'];
const WAVES = 'https://raw.githubusercontent.com/netcodermike/surfingcoder/buoy-data/waves/';

export function nearestBuoys(stations, location) {
  return stations.map(station => ({ ...station, km: distanceKm(location, station) }))
    .filter(station => station.km <= RADIUS_KM)
    .sort((first, second) => first.km - second.km)
    .slice(0, 3);
}

function formatDistance(km, units) {
  return units === 'metric' ? Math.round(km) + ' km' : Math.round(km / 1.609344) + ' mi';
}

export function parseReadings(data, stationId) {
  const { columnNames, rows } = data?.table ?? {};
  if (!Array.isArray(columnNames) || !Array.isArray(rows)) return [];
  const indexes = fields.map(field => columnNames.indexOf(field));
  const averageIndex = columnNames.indexOf('APD');
  if (indexes.some(index => index < 0)) return [];
  return rows.flatMap(row => {
    if (!Array.isArray(row)) return [];
    const [id, iso, wave, period, direction, temperature] = indexes.map(index => row[index]);
    const time = Date.parse(iso);
    return id === stationId && Number.isFinite(time) && Number.isFinite(wave) && wave >= 0
      ? [{ time, wave, period, direction, temperature, averagePeriod: row[averageIndex] }] : [];
  }).sort((a, b) => b.time - a.time);
}

function readStation(stationId, signal) {
  // NOAA supports JSONP for browsers. The sandbox keeps its script away from the site’s DOM and storage.
  const query = [...fields, 'APD'].join(',') + '&station=' + encodeURIComponent('"' + stationId + '"') +
    '&time%3Enow-36hours&.jsonp=receiveBuoyData';
  const url = (COASTWATCH + '.json?' + query).replaceAll('&', '&amp;');
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.sandbox = 'allow-scripts';
    frame.title = 'NOAA observation data';
    frame.hidden = true;
    const complete = (error, rows) => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      signal.removeEventListener('abort', abort);
      frame.remove();
      if (error) reject(error);
      else resolve(rows);
    };
    const onMessage = event => {
      if (event.source !== frame.contentWindow || event.origin !== 'null') return;
      complete(null, parseReadings(event.data, stationId));
    };
    const abort = () => complete(signal.reason);
    const timer = setTimeout(() => complete(Error('Buoy request timed out')), 12000);
    window.addEventListener('message', onMessage);
    signal.addEventListener('abort', abort, { once: true });
    frame.srcdoc = '<meta charset="utf-8"><script>function receiveBuoyData(data){parent.postMessage(data,' +
      JSON.stringify(location.origin) + ')}</script><script referrerpolicy="no-referrer" src="' + url +
      '" onerror="receiveBuoyData(null)"></script>';
    document.body.append(frame);
  });
}

async function readObservations(stationId, signal) {
  if (stationId === '41159') {
    const variables = [
      'time', 'sea_surface_wave_significant_height', 'sea_surface_wave_period_at_variance_spectral_density_maximum',
      'sea_surface_wave_from_direction_at_variance_spectral_density_maximum', 'sea_water_temperature',
    ];
    try {
      const response = await fetch(ONSLOW_DATASET + '.json?' + variables.join(',') + '&time%3Enow-36hours', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });
      if (!response.ok) throw Error('Onslow Bay data unavailable');
      const { table } = await response.json();
      const indexes = variables.map(variable => table.columnNames.indexOf(variable));
      const rows = table.rows.map(row => [stationId, ...indexes.map(index => row[index])]);
      const readings = parseReadings({ table: { columnNames: fields, rows } }, stationId);
      if (readings.length) return { readings, source: ONSLOW_DATASET + '.html' };
    } catch {
      signal.throwIfAborted();
    }
  }
  return { readings: await readStation(stationId, signal), source: COASTWATCH + '.html' };
}

async function readDetailedWaves(stationId, signal) {
  const response = await fetch(WAVES + encodeURIComponent(stationId) + '.json', {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]), cache: 'no-cache',
  });
  if (!response.ok) return [];
  const rows = await response.json();
  const cutoff = Date.now() - 36 * 3600000;
  return Array.isArray(rows) ? rows.filter(row => row.time >= cutoff) : [];
}

export function mergeWaveReadings(standard, detailed) {
  const unmatched = new Set(standard);
  const readings = detailed.map(row => {
    let closest, distance = 5 * 60000 + 1;
    for (const candidate of unmatched) {
      const delta = Math.abs(candidate.time - row.time);
      if (delta < distance) { closest = candidate; distance = delta; }
    }
    unmatched.delete(closest);
    return { ...closest, ...row };
  });
  return [...readings, ...unmatched].sort((a, b) => b.time - a.time);
}

export function setupBuoyView(getUnits) {
  const get = id => document.getElementById(id);
  const forecast = get('forecast-view');
  const forecastHours = get('forecast-hours');
  const forecastButton = get('show-forecast');
  const buoyButton = get('show-buoys');
  const picker = get('buoy-station');
  const observation = get('buoy-readings');
  const note = get('buoy-note');
  const stationLink = get('buoy-station-link');
  let location;
  let catalog;
  let pending;
  let candidates = [];
  let displayedStation;
  let request;
  let readings;
  let chartWidth = 0;
  let chart;
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  const dataLink = get('buoy-data-link');

  function node(tag, text, className) {
    const value = document.createElement(tag);
    value.textContent = text;
    if (className) value.className = className;
    return value;
  }

  function measurementValues(item) {
    const units = getUnits(), metric = units === 'metric';
    const format = (value, unit) => Number.isFinite(value) ? value.toFixed(1) + unit : '—';
    const size = value => format(height(value, units), metric ? ' m' : ' ft');
    const seconds = value => format(value, ' s');
    const direction = value => Number.isFinite(value) ? compass(value) : value || '—';
    const temperature = Number.isFinite(item.temperature) && !metric ? item.temperature * 1.8 + 32 : item.temperature;
    return [
      ['Significant height', size(item.wave)], ['Peak period', seconds(item.period)],
      ['Average period', seconds(item.averagePeriod)], ['Wave from', direction(item.direction)],
      ['Swell height', size(item.swell)], ['Swell period', seconds(item.swellPeriod)], ['Swell from', direction(item.swellDirection)],
      ['Wind wave height', size(item.windWave)], ['Wind wave period', seconds(item.windWavePeriod)],
      ['Wind waves from', direction(item.windWaveDirection)], ['Steepness', item.steepness ?? '—'],
      ['Water temperature', format(temperature, metric ? ' °C' : ' °F')],
    ];
  }

  function makeChart() {
    chartWidth = observation.clientWidth;
    return drawBuoyChart(readings, getUnits(), chartWidth || 320, date, measurementValues);
  }

  new ResizeObserver(() => {
    if (!chart?.isConnected || !observation.clientWidth || chartWidth === observation.clientWidth) return;
    const replacement = makeChart();
    chart.replaceWith(replacement);
    chart = replacement;
  }).observe(observation);

  function drawReadings() {
    observation.replaceChildren();
    chart = undefined;
    if (!displayedStation) return;
    if (!readings?.length) {
      observation.append(node('p', readings ? 'No recent readings are available. Try another buoy or open NOAA’s station history.' :
        'Loading wave observations…', 'buoy-reading-status'));
      return;
    }
    chart = makeChart();
    observation.append(chart);
    if (Date.now() - readings[0].time > 3 * 3600_000) {
      observation.append(node('p', 'The latest reading is over 3 hours old.', 'buoy-reading-status'));
    }
    const headings = measurementValues(readings[0]).map(([label]) => label);
    const history = node('section', '', 'buoy-history');
    const title = node('h4', 'Recent readings');
    title.id = 'buoy-history-heading';
    history.setAttribute('aria-labelledby', title.id);
    const scroll = node('div', '', 'buoy-table-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', 'Buoy observations, newest first');
    const table = document.createElement('table');
    const headingsRow = table.createTHead().insertRow();
    for (const label of ['Observed', ...headings]) {
      const header = node('th', label);
      header.scope = 'col';
      if (label === 'Observed') header.setAttribute('aria-sort', 'descending');
      headingsRow.append(header);
    }
    const body = table.createTBody();
    for (const item of readings) {
      const tr = body.insertRow();
      const stamp = node('time', date.format(item.time));
      stamp.dateTime = new Date(item.time).toISOString();
      tr.insertCell().append(stamp);
      for (const [, value] of measurementValues(item)) tr.append(node('td', value));
    }
    scroll.append(table);
    history.append(title, scroll);
    observation.append(history);
  }

  function showStation(refresh = false) {
    const buoy = candidates.find(station => station.id === picker.value);
    stationLink.hidden = !buoy;
    dataLink.hidden = !buoy;
    get('reload-buoy').disabled = !buoy;
    if (!buoy) {
      request?.abort();
      displayedStation = undefined;
      drawReadings();
      return;
    }
    stationLink.href = NDBC + '/station_page.php?station=' + encodeURIComponent(buoy.id);
    note.textContent = formatDistance(buoy.km, getUnits()) + ' from ' + location.label;
    if (buoy.id === displayedStation && !refresh) { drawReadings(); return; }
    request?.abort();
    const controller = new AbortController();
    request = controller;
    displayedStation = buoy.id;
    readings = undefined;
    dataLink.href = COASTWATCH + '.html';
    drawReadings();
    Promise.allSettled([readObservations(buoy.id, controller.signal), readDetailedWaves(buoy.id, controller.signal)]).then(([standard, detailed]) => {
      if (controller.signal.aborted) return;
      const extra = detailed.status === 'fulfilled' ? detailed.value : [];
      const base = standard.status === 'fulfilled' ? standard.value : { readings: [], source: COASTWATCH + '.html' };
      readings = mergeWaveReadings(base.readings, extra);
      dataLink.href = extra.length ? NDBC + '/data/realtime2/' + encodeURIComponent(buoy.id) + '.spec' : base.source;
      drawReadings();
    }).catch(() => {
      if (controller.signal.aborted) return;
      readings = [];
      drawReadings();
    });
  }

  function render() {
    if (!location) return;
    const url = new URL('/radial_search.php', NDBC);
    url.search = new URLSearchParams({
      lat1: location.lat, lon1: location.lon, uom: 'M', dist: String(RADIUS_KM), ot: 'B', time: '6',
    });
    get('buoy-search-link').href = url;
    const selected = picker.value;
    candidates = catalog ? nearestBuoys(catalog.stations, location) : [];
    picker.replaceChildren(...candidates.map(buoy =>
      new Option(buoy.id + ' · ' + buoy.name + ' (' + formatDistance(buoy.km, getUnits()) + ')', buoy.id)));
    if (candidates.some(buoy => buoy.id === selected)) picker.value = selected;
    get('buoy-picker').hidden = !candidates.length;
    showStation();
    if (!candidates.length) {
      note.textContent = catalog ? 'No wave buoys in our station list are within ' + formatDistance(RADIUS_KM, getUnits()) + ' of this location.' :
        pending ? 'Loading nearby NOAA wave buoys…' : 'The station list is unavailable. Use NOAA’s nearby observations search.';
    }
  }

  function loadCatalog() {
    if (catalog || pending) return;
    const url = new URL('ndbc-stations.json?v=20261116', import.meta.url);
    pending = fetch(url).then(async response => {
      if (!response.ok) throw Error('Station list unavailable');
      const data = await response.json();
      if (!Array.isArray(data.stations)) throw Error('Invalid station list');
      catalog = data;
    }).catch(() => {
      catalog = undefined;
    }).finally(() => {
      pending = null;
      render();
    });
  }

  function selectView(showBuoys) {
    forecast.hidden = showBuoys;
    forecastHours.hidden = showBuoys;
    forecastButton.setAttribute('aria-pressed', String(!showBuoys));
    buoyButton.setAttribute('aria-pressed', String(showBuoys));
    if (showBuoys) {
      loadCatalog();
      render();
    }
  }

  forecastButton.onclick = () => selectView(false);
  buoyButton.onclick = () => selectView(true);
  picker.onchange = () => showStation();
  get('reload-buoy').onclick = () => showStation(true);
  return {
    setLocation(next) {
      if (next.lat !== location?.lat || next.lon !== location?.lon || next.label !== location?.label) {
        picker.value = '';
      }
      location = next;
      loadCatalog();
      render();
    },
    updateUnits: render,
  };
}
