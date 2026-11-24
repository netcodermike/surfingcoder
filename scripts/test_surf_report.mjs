import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeWaveReadings, parseReadings } from '../surfreport/src/buoys.js';
import { forecastWindow } from '../surfreport/src/chart-ranges.js';
import { align } from '../surfreport/src/core.js';
import { loadTides, tideAt } from '../surfreport/src/tides.js';

const hour = 3600;
const start = Date.UTC(2026, 10, 24) / 1000;

test('marine data survives missing weather and rejects an empty height forecast', () => {
  const marine = { hourly: {
    time: [start + hour, 'bad', start, start],
    wave_height: [1.7, 2, 1.2, null],
    swell_wave_height: [null, 2, null, 0.8],
  } };
  const weather = { hourly: { time: [start, start + 2 * hour], wind_speed_10m: [11, 9] } };
  const rows = align(marine, weather);
  assert.deepEqual(rows.map(({ time, wave, swell, speed }) => [time, wave, swell, speed]), [
    [start, 1.2, 0.8, 11], [start + hour, 1.7, null, undefined],
  ]);
  assert.equal(align(marine)[0].wave, 1.2);
  assert.throws(() => align({ hourly: { time: [start], wave_height: [-1] } }), /No marine wave heights/);
});

test('the forecast never replays old readings after the forecast expires', () => {
  const rows = [0, 1, 2].map(offset => ({ time: start + offset * hour }));
  const now = start + 0.5;
  assert.deepEqual(forecastWindow(rows, 1, now), { start: now, end: rows[2].time, rows: rows.slice(1) });
  assert.deepEqual(forecastWindow(rows, 1, rows[2].time).rows, rows.slice(2));
  const expired = rows[2].time + 1;
  assert.deepEqual(forecastWindow(rows, 1, expired), { start: expired, end: expired, rows: [] });
});

test('Onslow Bay peak periods match the corresponding NDBC sea state', () => {
  const source = 'https://erddap.secoora.org/erddap/tabledap/41159-lej3wave-lej3w-onslow-b.html';
  const time = (hours, minutes) => Date.UTC(2026, 10, 24, hours, minutes);
  const native = [
    { time: time(4, 56), wave: 1, direction: 115, period: 9, swell: 0.2 },
    { time: time(4, 26), wave: 1.1, direction: 112, period: 8, swell: 0.2 },
  ];
  const direct = [
    { time: time(4, 30), wave: 1.03, direction: 115, period: 9.09 },
    { time: time(4, 0), wave: 1.1, direction: 112, period: 8.33 },
  ];
  const matched = mergeWaveReadings(direct, native, source);
  assert.deepEqual(matched.map(row => [row.time, row.period, row.direction]), [
    [time(4, 56), 9.09, 115], [time(4, 26), 8.33, 112],
  ]);
  assert.equal(mergeWaveReadings([{ ...direct[0], direction: 180 }], native, source)[0].period, 9);
  assert.deepEqual(mergeWaveReadings(direct, [], source), direct);
});

test('missing buoy sentinels cannot become valid wind or water readings', () => {
  const payload = { table: {
    columnNames: ['station', 'time', 'WVHT', 'MWD', 'WTMP', 'DPD'],
    rows: [
      ['41159', '2026-11-24T04:30:00Z', 99, 90, 20, 9],
      ['41159', '2026-11-24T04:00:00Z', 1.1, 999, 999, 99],
    ],
  } };
  assert.deepEqual(parseReadings(payload, '41159'), [{ time: Date.UTC(2026, 10, 24, 4), wave: 1.1 }]);
});

test('NOAA tide interpolation includes neighboring GMT dates', async t => {
  let query;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('/stations.json')) return Response.json({ stations: [
      { id: '8656590', type: 'R', lat: 34.68, lng: -76.89, name: 'Atlantic Beach Triple S Pier' },
    ] });
    query = new URL(url).searchParams;
    return Response.json({ predictions: [
      { t: '2026-11-23 23:54', v: '0.2' }, { t: '2026-11-24 00:00', v: '0.4' },
      { t: '2026-11-24 00:06', v: '0.6' }, { t: 'invalid', v: '4' },
    ] });
  });
  const { samples, station } = await loadTides({ lat: 34.682, lon: -76.893, label: 'Indian Beach, NC' },
    start - 180, start + 360, new AbortController().signal);
  assert.equal(station.id, '8656590');
  assert.equal(query.get('begin_date'), '20261123');
  assert.equal(query.get('end_date'), '20261124');
  assert.equal(query.get('time_zone'), 'gmt');
  assert.ok(Math.abs(tideAt(samples, start - 180) - 0.3) < 1e-10);
  assert.equal(tideAt(samples, start + 361), null);
});
