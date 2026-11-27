import { MAX_RANGE_DAYS } from './chart-ranges.js?v=20261124-five-days';

const MARINE_API = 'https://marine-api.open-meteo.com/v1/marine';
const HOUR = 60 * 60 * 1000;
const HOURS_PER_DAY = 24;
const MATCH_WINDOW = 15 * 60 * 1000;

function validHeight(value) {
  return Number.isFinite(value) && value >= 0 && value < 99;
}

export async function loadBuoyModel(station, signal, { days = MAX_RANGE_DAYS, now = Date.now() } = {}) {
  const hours = days * HOURS_PER_DAY;
  const end = Math.floor(now / HOUR) * HOUR;
  const start = end - hours * HOUR;
  const params = new URLSearchParams({
    latitude: station.lat, longitude: station.lon, cell_selection: 'sea',
    hourly: 'wave_height', timezone: 'GMT', timeformat: 'unixtime', length_unit: 'metric',
    past_hours: hours + 1, forecast_hours: 1,
  });
  const timeout = AbortSignal.timeout(15000);
  const response = await fetch(MARINE_API + '?' + params, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw Error('Open-Meteo buoy history returned HTTP ' + response.status + '.');
  const { hourly, hourly_units: units } = await response.json();
  if (!Array.isArray(hourly?.time) || !Array.isArray(hourly.wave_height) || units?.wave_height !== 'm') {
    throw Error('Open-Meteo returned invalid buoy wave-height data.');
  }

  const heights = new Map();
  hourly.time.forEach((seconds, index) => {
    if (!Number.isInteger(seconds)) return;
    const time = seconds * 1000;
    const height = hourly.wave_height[index];
    if (time >= start && time <= end && time % HOUR === 0 && validHeight(height)) {
      heights.set(time, height);
    }
  });
  if (!heights.size) throw Error('Open-Meteo returned no significant wave heights for this buoy.');

  return Array.from({ length: hours + 1 }, (_, index) => {
    const time = start + index * HOUR;
    return { time, modelHeight: heights.get(time) ?? null };
  });
}

export function matchBuoyObservations(modelRows, readings) {
  const observations = readings.filter(row => Number.isFinite(row.time) && validHeight(row.wave))
    .sort((first, second) => first.time - second.time);
  return modelRows.map(row => {
    let match;
    let distance = MATCH_WINDOW + 1;
    for (const observation of observations) {
      if (observation.time > row.time + MATCH_WINDOW) break;
      const delta = Math.abs(observation.time - row.time);
      if (delta <= MATCH_WINDOW && delta < distance) {
        match = observation;
        distance = delta;
      }
    }
    return { ...row, observedHeight: match?.wave ?? null, observedTime: match?.time ?? null };
  });
}
