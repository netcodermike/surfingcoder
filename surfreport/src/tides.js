import { distanceKm } from './core.js?v=20261117-tides-wind';

const catalogUrl = 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions';
const predictionsUrl = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const maxDistanceKm = 80;
const intervalSeconds = 6 * 60;
let catalog;

async function readJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('NOAA tide request failed');
  return response.json();
}

function referenceStations() {
  catalog ??= readJson(catalogUrl, AbortSignal.timeout(12000)).then(({ stations }) =>
    stations.filter(station => station.type === 'R' && Number.isFinite(station.lat) && Number.isFinite(station.lng))
  ).catch(error => {
    catalog = undefined;
    throw error;
  });
  return catalog;
}

export function tideStation(stations, location) {
  const nearby = stations.map(station => ({
    ...station, distance: distanceKm(location, { lat: station.lat, lon: station.lng }),
  })).filter(station => station.distance <= maxDistanceKm);
  // Atlantic Beach's ocean pier represents Indian Beach better than the nearer sound-side creek.
  const pier = location.label === 'Indian Beach, NC' && nearby.find(station => station.id === '8656590');
  return pier || nearby.sort((a, b) => a.distance - b.distance)[0];
}

export async function loadTides(location, start, end, signal) {
  const station = tideStation(await referenceStations(), location);
  if (!station) return null;
  const date = time => new Date(time * 1000).toISOString().slice(0, 10).replaceAll('-', '');
  const query = new URLSearchParams({
    product: 'predictions', application: 'SurfingCoder', station: station.id,
    begin_date: date(start), end_date: date(end), datum: 'MLLW', time_zone: 'gmt',
    units: 'metric', interval: '6', format: 'json',
  });
  const { predictions } = await readJson(predictionsUrl + '?' + query, signal);
  const samples = (predictions ?? []).filter(row => row.v != null && String(row.v).trim()).map(row => ({
    time: Date.parse(row.t.replace(' ', 'T') + ':00Z') / 1000,
    value: Number(row.v),
  })).filter(row => Number.isFinite(row.value) && row.time >= start - intervalSeconds && row.time <= end + intervalSeconds)
    .sort((a, b) => a.time - b.time);
  if (samples.length < 2) throw new Error('NOAA returned no tide predictions');
  return { station, samples };
}

export function tideAt(samples, time) {
  const next = samples.findIndex(sample => sample.time >= time);
  if (next === -1) return null;
  const after = samples[next];
  if (after.time === time) return after.value;
  const before = samples[next - 1];
  if (!before || after.time - before.time > intervalSeconds) return null;
  return before.value + (after.value - before.value) * (time - before.time) / (after.time - before.time);
}
