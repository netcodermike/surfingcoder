import { compass, distanceKm, height } from './core.js?v=20261124-review';
import { drawBuoyChart } from './buoy-chart.js?v=20261124-five-days';
import { renderBuoyComparison } from './buoy-comparison-chart.js?v=20261127-buoy-comparison';
import { loadBuoyModel, matchBuoyObservations } from './buoy-comparison.js?v=20261127-buoy-comparison';
import { DAY_SECONDS, MAX_RANGE_DAYS, formatDayRange } from './chart-ranges.js?v=20261124-five-days';

const HOUR = 3600000;
const MINUTE = 60000;
const HISTORY_HOURS = MAX_RANGE_DAYS * 24 + 12;
const FRESH_HOURS = 2;
const COMPARISON_DAYS = 2;
const HISTORY_QUERY = `&time%3Enow-${HISTORY_HOURS}hours`;
const RADIUS_KM = 250;
const NDBC = 'https://www.ndbc.noaa.gov';
const COASTWATCH = 'https://coastwatch.pfeg.noaa.gov/erddap/tabledap/cwwcNDBCMet';
const ONSLOW_DATASET = 'https://erddap.secoora.org/erddap/tabledap/41159-lej3wave-lej3w-onslow-b';
const fields = ['station', 'time', 'WVHT', 'MWD', 'WTMP'];
const LIVE_WAVES = 'https://surfingcoder-buoy-api.dreamymanatee10.chatgpt.site/waves/';
const WAVES_API = 'https://api.github.com/repos/netcodermike/surfingcoder/contents/waves/';
const WAVES_RAW = 'https://raw.githubusercontent.com/netcodermike/surfingcoder/buoy-data/waves/';
const COMPASS = new Set('N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW'.split(' '));
const STEEPNESS = new Set(['very steep', 'steep', 'average', 'swell']);
const heightFields = ['wave', 'swell', 'windWave'];
const periodFields = ['period', 'averagePeriod', 'swellPeriod', 'windWavePeriod'];
const directionFields = ['direction', 'swellDirection', 'windWaveDirection'];

function inRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function normalizeReading(row) {
  const clean = { time: row.time };
  for (const key of heightFields) {
    if (inRange(row[key], 0, 99) && row[key] < 99) clean[key] = row[key];
  }
  for (const key of periodFields) {
    if (inRange(row[key], 0, 99) && row[key] > 0 && row[key] < 99) clean[key] = row[key];
  }
  for (const key of directionFields) {
    const direction = row[key];
    if (inRange(direction, 0, 360) || COMPASS.has(direction)) clean[key] = direction;
  }
  if (inRange(row.temperature, -5, 50)) clean.temperature = row.temperature;
  if (STEEPNESS.has(row.steepness)) clean.steepness = row.steepness;
  return clean;
}

function mergeReadingBatches(previous, incoming, now = Date.now()) {
  const cutoff = now - HISTORY_HOURS * HOUR;
  const readings = new Map();
  for (const row of [...previous, ...incoming]) {
    if (!inRange(row?.time, cutoff, now)) continue;
    const clean = normalizeReading(row);
    readings.set(clean.time, { ...readings.get(clean.time), ...clean });
  }
  return [...readings.values()].filter(row => heightFields.some(key => Number.isFinite(row[key])))
    .sort((first, second) => second.time - first.time);
}

function hasSpectralData(row) {
  return ['swell', 'swellPeriod', 'windWave', 'windWavePeriod'].some(key => Number.isFinite(row[key]));
}

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
  const [stationIndex, timeIndex, waveIndex, directionIndex, temperatureIndex, peakIndex] =
    [...fields, 'DPD'].map(field => columnNames.indexOf(field));
  if ([stationIndex, timeIndex, waveIndex].some(index => index < 0)) return [];
  return rows.flatMap(row => {
    if (!Array.isArray(row)) return [];
    const iso = row[timeIndex];
    if (row[stationIndex] !== stationId || typeof iso !== 'string') return [];
    const time = Date.parse(iso);
    if (!Number.isFinite(time)) return [];
    const reading = normalizeReading({
      time, wave: row[waveIndex], direction: row[directionIndex],
      temperature: row[temperatureIndex], period: row[peakIndex],
    });
    return Number.isFinite(reading.wave) ? [reading] : [];
  }).sort((a, b) => b.time - a.time);
}

function readStation(stationId, signal) {
  // NOAA supports JSONP for browsers. The sandbox keeps its script away from the site’s DOM and storage.
  const query = [...fields, 'DPD'].join(',') + '&station=' + encodeURIComponent('"' + stationId + '"') +
    HISTORY_QUERY + '&.jsonp=receiveBuoyData';
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
      const response = await fetch(ONSLOW_DATASET + '.json?' + variables.join(',') + HISTORY_QUERY, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });
      if (!response.ok) throw Error('Onslow Bay data unavailable');
      const { table } = await response.json();
      const indexes = variables.map(variable => table.columnNames.indexOf(variable));
      const rows = table.rows.map(row => [stationId, ...indexes.map(index => row[index])]);
      const readings = mergeReadingBatches([], parseReadings({ table: { columnNames: [...fields, 'DPD'], rows } }, stationId));
      if (readings.length) return { readings, source: ONSLOW_DATASET + '.html' };
    } catch {
      signal.throwIfAborted();
    }
  }
  return { readings: await readStation(stationId, signal), source: COASTWATCH + '.html' };
}

async function readDetailedWaves(stationId, signal) {
  const file = encodeURIComponent(stationId) + '.json';
  const now = Date.now();
  const endpoints = [
    { url: LIVE_WAVES + file, timeout: 6500, cache: 'no-cache' },
    { url: WAVES_API + file + '?ref=buoy-data', timeout: 3750, cache: 'no-cache',
      headers: { Accept: 'application/vnd.github.raw+json' } },
    { url: WAVES_RAW + file, timeout: 3750, cache: 'no-cache' },
  ];
  let readings = [];
  for (const { url, timeout, ...options } of endpoints) {
    try {
      const response = await fetch(url, {
        ...options, signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]),
      });
      if (!response.ok) continue;
      const rows = await response.json();
      if (!Array.isArray(rows)) continue;
      // Keep the first successful source's values when the mirrors overlap.
      readings = mergeReadingBatches(rows, readings, now);
      const latestDetailed = readings.find(hasSpectralData);
      if (latestDetailed && now - latestDetailed.time <= FRESH_HOURS * HOUR) return readings;
    } catch {
      signal.throwIfAborted();
    }
  }
  return readings;
}

function sameOnslowObservation(direct, native) {
  // Equivalent 41159 NDBC bulk wave records are observed 26 minutes later
  // than the SECOORA timestamps.
  // Confirm that they describe the same waves before using decimal precision.
  return Number.isFinite(direct.direction) && direct.direction === native.direction &&
    Math.abs(direct.wave - native.wave) <= .11 &&
    (!Number.isFinite(direct.period) || !Number.isFinite(native.period) || Math.abs(direct.period - native.period) <= .6);
}

export function mergeWaveReadings(standard, detailed, source = COASTWATCH + '.html') {
  const unmatched = new Set([...new Map(standard.map(row => [row.time, row])).values()]);
  const onslow = source === ONSLOW_DATASET + '.html';
  const native = [...new Map(detailed.map(row => [row.time, row])).values()].sort((a, b) => b.time - a.time);
  const readings = native.map(row => {
    let closest, distance = 5 * MINUTE + 1;
    for (const candidate of unmatched) {
      if (onslow) {
        if (candidate.time + 26 * MINUTE === row.time && sameOnslowObservation(candidate, row)) {
          closest = candidate;
          break;
        }
        continue;
      }
      const delta = Math.abs(candidate.time - row.time);
      if (delta < distance) { closest = candidate; distance = delta; }
    }
    unmatched.delete(closest);
    const matched = { ...closest, ...row };
    if (onslow && Number.isFinite(closest?.period)) matched.period = closest.period;
    return matched;
  });
  const independent = onslow && native.length
    ? [...unmatched].filter(row => row.time > native[0].time || row.time + 26 * MINUTE < native.at(-1).time)
    : unmatched;
  return [...readings, ...independent].sort((a, b) => b.time - a.time);
}

export function setupBuoyView(getUnits) {
  const get = id => document.getElementById(id);
  const picker = get('buoy-station');
  const comparison = get('buoy-comparison');
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
  let standard = [];
  let native = [];
  let standardSource = COASTWATCH + '.html';
  let comparisonArchive = [];
  let modelRows = [];
  let modelLoading = false;
  let modelStatus = '';
  let comparisonWidth = 0;
  let chartWidth = 0;
  let chart;
  let observationDays = 2;
  let observationEnd;
  let selectedTime;
  const hiddenLayers = new Set(['windWave']);
  const dateFormatter = timeZone => new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone,
  });
  let date = dateFormatter('UTC');
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
    return drawBuoyChart(readings, getUnits(), chartWidth || 320, date, item => measurements(item).waves, hiddenLayers, {
      days: observationDays,
      end: observationEnd,
      station: displayedStation,
      selectedTime,
      onSelectTime(time) { selectedTime = time; },
      onRangeChange(days) {
        observationDays = days;
        drawReadings();
        get('observation-days')?.focus({preventScroll:true});
      },
    });
  }

  function drawComparison() {
    comparisonWidth = comparison.clientWidth;
    // SECOORA timestamps for 41159 differ from NOAA's. Compare at the original NDBC timestamps.
    const noaaReadings = standardSource === ONSLOW_DATASET + '.html'
      ? mergeReadingBatches(comparisonArchive, native)
      : readings ?? [];
    renderBuoyComparison(comparison, {
      station: displayedStation,
      rows: matchBuoyObservations(modelRows, noaaReadings),
      units: getUnits(),
      timeZone: date.resolvedOptions().timeZone,
      width: comparisonWidth || undefined,
      status: modelStatus,
      loading: (!modelRows.length && modelLoading) || readings === undefined,
    });
  }

  new ResizeObserver(() => {
    if (comparison.clientWidth && comparisonWidth !== comparison.clientWidth) drawComparison();
  }).observe(comparison);

  new ResizeObserver(() => {
    if (!chart?.isConnected || !observation.clientWidth || chartWidth === observation.clientWidth) return;
    const focusId = chart.contains(document.activeElement) ? document.activeElement.id : '';
    const replacement = makeChart();
    chart.replaceWith(replacement);
    chart = replacement;
    if (focusId) get(focusId)?.focus({ preventScroll: true });
  }).observe(observation);

  function drawReadings() {
    const priorScroll = observation.querySelector('.buoy-table-scroll');
    const scrollTop = priorScroll?.scrollTop ?? 0;
    const scrollLeft = priorScroll?.scrollLeft ?? 0;
    const scrollFocused = document.activeElement === priorScroll;
    const focusId = observation.contains(document.activeElement) ? document.activeElement.id : '';
    observation.replaceChildren();
    chart = undefined;
    if (!displayedStation) return;
    if (!readings) {
      observation.append(node('p', 'Loading wave observations…', 'buoy-reading-status'));
      return;
    }
    const end = observationEnd = Date.now();
    const start = end - observationDays * DAY_SECONDS * 1000;
    const recent = readings.filter(row => row.time >= start && row.time <= end);
    const latestDetailed = recent.find(hasSpectralData);
    if (recent.length && end - recent[0].time > 3 * HOUR) {
      observation.append(node('p', 'The latest reading is over 3 hours old.', 'buoy-reading-status'));
    } else if (latestDetailed && recent[0].time > latestDetailed.time) {
      observation.append(node('p', 'Swell and wind-wave readings are available through ' + date.format(latestDetailed.time) +
        '. Newer basic readings are shown below.', 'buoy-reading-status'));
    } else if (recent.length && !latestDetailed) {
      observation.append(node('p', 'Only basic wave readings are available in this time range.', 'buoy-reading-status'));
    }
    chart = makeChart();
    observation.append(chart);
    if (focusId) get(focusId)?.focus({ preventScroll: true });
    if (!recent.length) return;
    const headings = tableMeasurements(recent[0]).map(([label]) => label);
    const history = node('section', '', 'buoy-history');
    const title = node('h4', `Recent readings · Last ${formatDayRange(observationDays)}`);
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
    for (const item of recent) {
      const tr = body.insertRow();
      const stamp = node('time', date.format(item.time));
      stamp.dateTime = new Date(item.time).toISOString();
      tr.insertCell().append(stamp);
      for (const [, value] of tableMeasurements(item)) tr.append(node('td', value));
    }
    scroll.append(table);
    history.append(title, scroll);
    observation.append(history);
    scroll.scrollTop = scrollTop;
    scroll.scrollLeft = scrollLeft;
    if (scrollFocused) scroll.focus({ preventScroll: true });
  }

  function clearSources() {
    standard = [];
    native = [];
    standardSource = COASTWATCH + '.html';
    comparisonArchive = [];
    modelRows = [];
    modelLoading = false;
    modelStatus = '';
    selectedTime = undefined;
  }

  async function updateComparisonModel(station, signal) {
    try {
      const next = await loadBuoyModel(station, signal, { days: COMPARISON_DAYS });
      if (signal.aborted) return;
      modelRows = next;
    } catch {
      if (signal.aborted) return;
      modelStatus = modelRows.length
        ? 'Could not refresh Open-Meteo. Showing the previous model estimate.'
        : 'Open-Meteo’s historical model estimate is temporarily unavailable for this buoy.';
    } finally {
      if (!signal.aborted) {
        modelLoading = false;
        drawComparison();
      }
    }
  }

  async function fillComparisonFromNoaa(station, signal) {
    if (standardSource !== ONSLOW_DATASET + '.html') return;
    const latestWave = rows => rows.find(row => Number.isFinite(row.wave))?.time ?? -Infinity;
    if (Math.max(latestWave(native), latestWave(comparisonArchive)) >= latestWave(standard)) return;
    try {
      const rows = await readStation(station.id, signal);
      if (signal.aborted) return;
      comparisonArchive = mergeReadingBatches(comparisonArchive, rows);
      drawComparison();
    } catch {
      // The comparison can still use any NDBC observations already loaded.
    }
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
      clearSources();
      drawComparison();
      drawReadings();
      return;
    }
    stationLink.href = NDBC + '/station_page.php?station=' + encodeURIComponent(buoy.id);
    note.textContent = formatDistance(buoy.km, getUnits()) + ' from ' + location.label;
    const sameStation = buoy.id === displayedStation?.id;
    if (sameStation && !refresh) {
      drawComparison();
      drawReadings();
      return;
    }
    request?.abort();
    const controller = new AbortController();
    request = controller;
    displayedStation = buoy;
    if (!sameStation) clearSources();
    if (!sameStation || !readings?.length) {
      readings = undefined;
      dataLink.href = COASTWATCH + '.html';
      drawReadings();
    }
    modelLoading = true;
    modelStatus = '';
    drawComparison();
    const modelRequest = updateComparisonModel(buoy, controller.signal);
    const observationRequest = Promise.allSettled([
      readObservations(buoy.id, controller.signal), readDetailedWaves(buoy.id, controller.signal),
    ]).then(([basic, detailed]) => {
      if (controller.signal.aborted) return;
      const now = Date.now();
      standard = mergeReadingBatches(standard, [], now);
      if (basic.status === 'fulfilled') {
        const { source } = basic.value;
        const incoming = mergeReadingBatches([], basic.value.readings, now);
        if (source === standardSource) standard = mergeReadingBatches(standard, incoming, now);
        else if (incoming.length && (!standard.length || incoming[0].time >= standard[0].time)) {
          standard = incoming;
          standardSource = source;
        }
      }
      native = mergeReadingBatches(native, detailed.status === 'fulfilled' ? detailed.value : [], now);
      readings = mergeWaveReadings(standard, native, standardSource);
      dataLink.href = native.length
        ? NDBC + '/data/realtime2/' + encodeURIComponent(buoy.id) + (native.some(hasSpectralData) ? '.spec' : '.txt')
        : standardSource;
      drawComparison();
      drawReadings();
      return fillComparisonFromNoaa(buoy, controller.signal);
    }).catch(() => {
      if (controller.signal.aborted) return;
      if (!sameStation || !readings?.length) readings = [];
      drawComparison();
      drawReadings();
    });
    void Promise.allSettled([modelRequest, observationRequest]).then(() => {
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
      if (next.lat !== location?.lat || next.lon !== location?.lon) date = dateFormatter('UTC');
      if (next.lat !== location?.lat || next.lon !== location?.lon || next.label !== location?.label) {
        picker.value = '';
      }
      location = next;
      loadCatalog();
      render();
    },
    setTimeZone(timeZone) {
      let next;
      try { next = dateFormatter(timeZone ?? 'UTC'); }
      catch (error) {
        if (!(error instanceof RangeError)) throw error;
        next = dateFormatter('UTC');
      }
      if (next.resolvedOptions().timeZone !== date.resolvedOptions().timeZone) {
        date = next;
        drawComparison();
        drawReadings();
      }
    },
    updateUnits: render,
  };
}
