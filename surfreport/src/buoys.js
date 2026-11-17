import { compass, distanceKm, height } from './core.js?v=20261117-tides-wind';

const RADIUS_KM = 250;
const NDBC = 'https://www.ndbc.noaa.gov';
const COASTWATCH = 'https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet';
const ONSLOW_DATASET = 'https://erddap.secoora.org/erddap/tabledap/41159-lej3wave-lej3w-onslow-b';
const fields = ['station', 'time', 'WVHT', 'DPD', 'MWD', 'WTMP'];

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
  if (indexes.some(index => index < 0)) return [];
  return rows.flatMap(row => {
    if (!Array.isArray(row)) return [];
    const [id, iso, wave, period, direction, temperature] = indexes.map(index => row[index]);
    const time = Date.parse(iso);
    return id === stationId && Number.isFinite(time) && Number.isFinite(wave) && wave >= 0
      ? [{ time, wave, period, direction, temperature }] : [];
  }).sort((a, b) => b.time - a.time);
}

function readStation(stationId, signal) {
  // NOAA supports JSONP for browsers. The sandbox keeps its script away from the site’s DOM and storage.
  const query = fields.join(',') + '&station=' + encodeURIComponent('"' + stationId + '"') +
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

export function setupBuoyView(getUnits) {
  const get = id => document.getElementById(id);
  const forecast = get('forecast-view');
  const buoys = get('buoy-view');
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

  function drawReadings() {
    observation.replaceChildren();
    if (!displayedStation) return;
    if (!readings?.length) {
      observation.append(node('p', readings ? 'No recent readings are available. Try another buoy or open NOAA’s station history.' :
        'Loading wave observations…', 'buoy-reading-status'));
      return;
    }
    const metric = getUnits() === 'metric';
    const format = (value, unit, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) + unit : '—';
    const values = item => {
      const temperature = Number.isFinite(item.temperature) && !metric ? item.temperature * 1.8 + 32 : item.temperature;
      return [
        format(height(item.wave, getUnits()), metric ? ' m' : ' ft'),
        format(item.period, ' s', 0),
        Number.isFinite(item.direction) ? compass(item.direction) : '—',
        format(temperature, metric ? ' °C' : ' °F'),
      ];
    };
    const latest = readings[0];
    const observed = node('p', 'Observed ', 'buoy-reading-time');
    const time = node('time', date.format(latest.time));
    time.dateTime = new Date(latest.time).toISOString();
    observed.append(time);
    if (Date.now() - latest.time > 3 * 3600_000) observed.append(' · over 3 hours old');
    const headings = ['Wave height', 'Peak period', 'Wave from', 'Water temperature'];
    const summary = node('div', '', 'chips');
    for (const [index, value] of values(latest).entries()) {
      const card = node('div', '', 'chip');
      card.append(node('b', value), headings[index]);
      summary.append(card);
    }
    observation.append(observed, summary);
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
      for (const value of values(item)) tr.append(node('td', value));
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
    readObservations(buoy.id, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      readings = result.readings;
      dataLink.href = result.source;
      drawReadings();
    }).catch(() => {
      if (controller.signal.aborted) return;
      readings = [];
      drawReadings();
    });
  }

  function render() {
    if (!location || buoys.hidden) return;
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
    buoys.hidden = !showBuoys;
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
      render();
    },
    updateUnits: render,
  };
}
