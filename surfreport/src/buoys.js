import { compass, distanceKm, height } from './core.js?v=20261117-tides-wind';
import { drawBuoyChart } from './buoy-chart.js?v=20261120-observed-legend';

const HOUR = 3600000;
const RADIUS_KM = 250;
const NDBC = 'https://www.ndbc.noaa.gov';
const COASTWATCH = 'https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet';
const ONSLOW_DATASET = 'https://erddap.secoora.org/erddap/tabledap/41159-lej3wave-lej3w-onslow-b';
const fields = ['station', 'time', 'WVHT', 'MWD', 'WTMP'];
const WAVES_API = 'https://api.github.com/repos/netcodermike/surfingcoder/contents/waves/';
const WAVES_RAW = 'https://raw.githubusercontent.com/netcodermike/surfingcoder/buoy-data/waves/';

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
  const peakIndex = columnNames.indexOf('DPD');
  if (indexes.some(index => index < 0)) return [];
  return rows.flatMap(row => {
    if (!Array.isArray(row)) return [];
    const [id, iso, wave, direction, temperature] = indexes.map(index => row[index]);
    const time = Date.parse(iso), peak = row[peakIndex];
    const period = Number.isFinite(peak) && peak > 0 && peak < 99 ? peak : undefined;
    return id === stationId && Number.isFinite(time) && Number.isFinite(wave) && wave >= 0
      ? [{ time, wave, direction, temperature, period }] : [];
  }).sort((a, b) => b.time - a.time);
}

function readStation(stationId, signal) {
  // NOAA supports JSONP for browsers. The sandbox keeps its script away from the site’s DOM and storage.
  const query = [...fields, 'DPD'].join(',') + '&station=' + encodeURIComponent('"' + stationId + '"') +
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
      'time', 'sea_surface_wave_significant_height',
      'sea_surface_wave_from_direction_at_variance_spectral_density_maximum', 'sea_water_temperature',
      'sea_surface_wave_period_at_variance_spectral_density_maximum',
    ];
    try {
      const response = await fetch(ONSLOW_DATASET + '.json?' + variables.join(',') + '&time%3Enow-36hours', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });
      if (!response.ok) throw Error('Onslow Bay data unavailable');
      const { table } = await response.json();
      const indexes = variables.map(variable => table.columnNames.indexOf(variable));
      const rows = table.rows.map(row => [stationId, ...indexes.map(index => row[index])]);
      const readings = parseReadings({ table: { columnNames: [...fields, 'DPD'], rows } }, stationId);
      if (readings.length) return { readings, source: ONSLOW_DATASET + '.html' };
    } catch {
      signal.throwIfAborted();
    }
  }
  return { readings: await readStation(stationId, signal), source: COASTWATCH + '.html' };
}

async function readDetailedWaves(stationId, signal) {
  const file = encodeURIComponent(stationId) + '.json';
  const cutoff = Date.now() - 36 * HOUR;
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(7500)]);
  const endpoints = [
    [WAVES_API + file + '?ref=buoy-data', { Accept: 'application/vnd.github.raw+json' }],
    [WAVES_RAW + file, {}],
  ];
  // The branch-named raw URL can lag behind a successful publish. Prefer the Contents API.
  for (const [url, headers] of endpoints) {
    try {
      const response = await fetch(url, { signal: timeout, headers, cache: 'no-cache' });
      if (!response.ok) continue;
      const rows = await response.json();
      if (Array.isArray(rows)) return rows.filter(row => Number.isFinite(row?.time) && row.time >= cutoff)
        .sort((a, b) => b.time - a.time);
    } catch {
      signal.throwIfAborted();
    }
  }
  return [];
}

export function mergeWaveReadings(standard, detailed) {
  const unmatched = new Set([...new Map(standard.map(row => [row.time, row])).values()]);
  const readings = [...new Map(detailed.map(row => [row.time, row])).values()].sort((a, b) => b.time - a.time).map(row => {
    let closest, distance = 5 * 60000 + 1;
    for (const candidate of unmatched) {
      const delta = Math.abs(candidate.time - row.time);
      if (delta < distance) { closest = candidate; distance = delta; }
    }
    unmatched.delete(closest);
    const matched = { ...closest, ...row };
    // Direct buoy records can retain decimal precision where NDBC's standard file rounds.
    if (Number.isFinite(closest?.period)) matched.period = closest.period;
    return matched;
  });
  return [...readings, ...unmatched].sort((a, b) => b.time - a.time);
}

export function setupBuoyView(getUnits) {
  const get = id => document.getElementById(id);
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
  let mirrored = [];
  let chartWidth = 0;
  let chart;
  const hiddenLayers = new Set();
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

  function measurements(item) {
    const units = getUnits(), metric = units === 'metric';
    const format = (value, unit) => Number.isFinite(value) ? value.toFixed(1) + unit : '—';
    const size = value => format(height(value, units), metric ? ' m' : ' ft');
    const seconds = value => format(value, ' s');
    const direction = value => Number.isFinite(value) ? compass(value) : value || '—';
    const temperature = Number.isFinite(item.temperature) && !metric ? item.temperature * 1.8 + 32 : item.temperature;
    const waves = [
      ['Combined sea', [
        ['Significant height', size(item.wave)], ['Peak period', seconds(item.period)], ['Wave from', direction(item.direction)],
      ]],
      ['Swell', [
        ['Swell height', size(item.swell)], ['Swell period', seconds(item.swellPeriod)], ['Swell from', direction(item.swellDirection)],
      ]],
      ['Wind waves', [
        ['Wind wave height', size(item.windWave)], ['Wind wave period', seconds(item.windWavePeriod)],
        ['Wind waves from', direction(item.windWaveDirection)],
      ]],
    ];
    const other = [
      ['Steepness', item.steepness ?? '—'],
      ['Water temperature', format(temperature, metric ? ' °C' : ' °F')],
    ];
    return { waves, other };
  }

  function tableMeasurements(item) {
    const { waves, other } = measurements(item);
    return [...waves.flatMap(([, values]) => values), ...other];
  }

  function makeChart() {
    chartWidth = observation.clientWidth;
    return drawBuoyChart(readings, getUnits(), chartWidth || 320, date, item => measurements(item).waves, hiddenLayers);
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
    const latestDetailed = readings.find(row => ['swell', 'swellPeriod', 'windWave', 'windWavePeriod']
      .some(field => Number.isFinite(row[field])));
    if (Date.now() - readings[0].time > 3 * HOUR) {
      observation.append(node('p', 'The latest reading is over 3 hours old.', 'buoy-reading-status'));
    } else if (latestDetailed && readings[0].time > latestDetailed.time) {
      observation.append(node('p', 'Swell and wind-wave readings are available through ' + date.format(latestDetailed.time) +
        '. Newer basic readings are shown below.', 'buoy-reading-status'));
    }
    chart = makeChart();
    observation.append(chart);
    const headings = tableMeasurements(readings[0]).map(([label]) => label);
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
      for (const [, value] of tableMeasurements(item)) tr.append(node('td', value));
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
      request = undefined;
      displayedStation = undefined;
      mirrored = [];
      drawReadings();
      return;
    }
    stationLink.href = NDBC + '/station_page.php?station=' + encodeURIComponent(buoy.id);
    note.textContent = formatDistance(buoy.km, getUnits()) + ' from ' + location.label;
    const sameStation = buoy.id === displayedStation;
    if (sameStation && !refresh) { drawReadings(); return; }
    request?.abort();
    const controller = new AbortController();
    request = controller;
    displayedStation = buoy.id;
    if (!sameStation) mirrored = [];
    if (!sameStation || !readings?.length) {
      readings = undefined;
      dataLink.href = COASTWATCH + '.html';
      drawReadings();
    }
    Promise.allSettled([readObservations(buoy.id, controller.signal), readDetailedWaves(buoy.id, controller.signal)]).then(([standard, detailed]) => {
      if (controller.signal.aborted) return;
      const latest = detailed.status === 'fulfilled' ? detailed.value : [];
      if (latest.length && (!mirrored.length || latest[0].time >= mirrored[0].time)) mirrored = latest;
      mirrored = mirrored.filter(row => row.time >= Date.now() - 36 * HOUR);
      const base = standard.status === 'fulfilled' ? standard.value : { readings: [], source: COASTWATCH + '.html' };
      const merged = mergeWaveReadings(base.readings, mirrored);
      if (merged.length || !sameStation || !readings?.length) readings = merged;
      dataLink.href = mirrored.length ? NDBC + '/data/realtime2/' + encodeURIComponent(buoy.id) + '.spec' : base.source;
      drawReadings();
    }).catch(() => {
      if (controller.signal.aborted) return;
      if (!sameStation || !readings?.length) readings = [];
      drawReadings();
    }).finally(() => {
      if (request === controller) request = undefined;
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

  picker.onchange = () => showStation();
  get('reload-buoy').onclick = () => showStation(true);
  setInterval(() => {
    if (!document.hidden && displayedStation && !request) showStation(true);
  }, 5 * 60_000);
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
