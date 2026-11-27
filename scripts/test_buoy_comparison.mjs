import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBuoyModel, matchBuoyObservations } from '../surfreport/src/buoy-comparison.js';

const onslowBay = { id: '41159', name: 'Onslow Bay Outer, NC (217)', lat: 34.211, lon: -76.944 };
const minute = 60000;
const hour = 60 * minute;
const time = Date.parse('2026-11-27T07:00:00-05:00');

test('buoy comparison requests only marine height at the selected station and keeps missing hours', async t => {
  let query;
  t.mock.method(globalThis, 'fetch', async url => {
    query = new URL(url);
    return Response.json({
      hourly_units: { time: 'unixtime', wave_height: 'm' },
      hourly: {
        time: [time / 1000, (time + 2 * hour) / 1000, (time + 3 * hour) / 1000],
        wave_height: [3.58, 0, 8],
      },
    });
  });
  const rows = await loadBuoyModel(onslowBay, new AbortController().signal, { days: 2, now: time + 2.25 * hour });
  assert.equal(query.origin + query.pathname, 'https://marine-api.open-meteo.com/v1/marine');
  assert.deepEqual(Object.fromEntries(query.searchParams), {
    latitude: '34.211', longitude: '-76.944', hourly: 'wave_height', timezone: 'GMT',
    timeformat: 'unixtime', cell_selection: 'sea', length_unit: 'metric',
    past_hours: '49', forecast_hours: '1',
  });
  assert.equal(rows.length, 49);
  assert.deepEqual(rows.slice(-3), [
    { time, modelHeight: 3.58 },
    { time: time + hour, modelHeight: null },
    { time: time + 2 * hour, modelHeight: 0 },
  ]);
});

test('nearest valid NOAA height is matched in UTC within 15 minutes, including 6:56 a.m. EST', () => {
  const rows = [0, 1, 2, 3].map(offset => ({ time: time + offset * hour, modelHeight: 3.58 }));
  const firstObserved = Date.parse('2026-11-27T11:56:00Z');
  const endOfWindow = time + hour + 15 * minute;
  const matchingZero = time + 3 * hour;
  const readings = [
    { time: matchingZero, wave: 0, period: 20 },
    { time: time + 2 * hour + 15 * minute + 1, wave: 3.4 },
    { time: endOfWindow, wave: 2.8 },
    { time: time + 1 * minute, wave: 99 },
    { time: time + 5 * minute, wave: 3.32 },
    { time: firstObserved, wave: 3.30, period: 9 },
  ];
  assert.deepEqual(matchBuoyObservations(rows, readings), [
    { ...rows[0], observedHeight: 3.30, observedTime: firstObserved },
    { ...rows[1], observedHeight: 2.8, observedTime: endOfWindow },
    { ...rows[2], observedHeight: null, observedTime: null },
    { ...rows[3], observedHeight: 0, observedTime: matchingZero },
  ]);
});

test('buoy model history errors do not pass through as fabricated observations', async t => {
  const response = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  await assert.rejects(loadBuoyModel(onslowBay), /HTTP 503/);
  response.mock.mockImplementation(async () => Response.json({
    hourly_units: { wave_height: 'm' },
    hourly: { time: [time / 1000], wave_height: [null] },
  }));
  await assert.rejects(loadBuoyModel(onslowBay, undefined, { now: time }), /no significant wave heights/);
  assert.deepEqual(matchBuoyObservations([{ time, modelHeight: 3.58 }], []), [
    { time, modelHeight: 3.58, observedHeight: null, observedTime: null },
  ]);
});
