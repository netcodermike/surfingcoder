export const G = 9.81;

export const PRESETS = {
  'Gentle beach': { length: 80, depth: 1.6, endDepth: .45, beachStart: 50, amplitude: .05, period: 9, cycles: 4, gauge: 76, boundary: 'open' },
  'Steep beach': { length: 66, depth: 2.2, endDepth: .40, beachStart: 78, amplitude: .07, period: 8, cycles: 4, gauge: 90, boundary: 'open' },
  'Reflecting basin': { length: 48, depth: 1.1, endDepth: 1.1, beachStart: 65, amplitude: .05, period: 7, cycles: 2, gauge: 74, boundary: 'wall' },
};

const bounds = {
  length: [24, 160],
  depth: [.5, 4],
  endDepth: [.25, 4],
  beachStart: [25, 88],
  amplitude: [0, .4],
  period: [3, 15],
  cycles: [1, 10],
  gauge: [10, 94],
};

export function normalizeSettings(input) {
  const settings = {};
  for (const [key, [min, max]] of Object.entries(bounds)) {
    const value = Number(input[key]);
    settings[key] = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : PRESETS['Gentle beach'][key];
  }
  settings.endDepth = Math.min(settings.endDepth, settings.depth);
  settings.cycles = Math.round(settings.cycles);
  settings.boundary = input.boundary === 'wall' ? 'wall' : 'open';
  return settings;
}

export function depthAt(settings, position) {
  const start = settings.length * settings.beachStart / 100;
  const ramp = Math.max(0, Math.min(1, (position - start) / (settings.length - start)));
  return settings.depth + ramp * (settings.endDepth - settings.depth);
}

export function forcing(settings, time) {
  const cycle = time / settings.period;
  if (cycle <= 0 || cycle >= settings.cycles) return 0;
  const taper = Math.max(0, Math.min(1, cycle * 2, (settings.cycles - cycle) * 2));
  const envelope = .5 - .5 * Math.cos(Math.PI * taper);
  return settings.amplitude * envelope * Math.sin(2 * Math.PI * cycle);
}

export function createBasin(input, cells = 280) {
  if (!Number.isInteger(cells) || cells < 40 || cells > 2000) throw RangeError('Use 40 to 2,000 basin cells.');
  const settings = normalizeSettings(input);
  const dx = settings.length / cells;
  const sourceSpeed = Math.sqrt(G * settings.depth);
  const endSpeed = Math.sqrt(G * settings.endDepth);
  const faceSpeedSquared = Float64Array.from({ length: cells + 1 }, (_, i) => G * depthAt(settings, i * dx));
  const dtLimit = .42 * dx / sourceSpeed;
  const eta = new Float64Array(cells);
  const before = new Float64Array(cells);
  const after = new Float64Array(cells);
  const discharge = new Float64Array(cells + 1);
  const ratio = dtLimit / dx;
  let steps = 0;
  let time = 0;

  function advanceTo(target) {
    if (!Number.isFinite(target) || target < time || target > 600) throw RangeError('Choose a later time within ten minutes.');
    // Keep the numerical time step fixed regardless of frame cadence and gauge sampling.
    while (steps * dtLimit < target) {
      before.set(after);
      for (let j = 1; j < cells; j++) discharge[j] -= ratio * faceSpeedSquared[j] * (before[j] - before[j - 1]);
      discharge[0] = sourceSpeed * (2 * forcing(settings, (steps + .5) * dtLimit) - before[0]);
      discharge[cells] = settings.boundary === 'wall' ? 0 : endSpeed * before[cells - 1];
      for (let j = 0; j < cells; j++) after[j] = before[j] - ratio * (discharge[j + 1] - discharge[j]);
      steps++;
    }
    const fraction = steps ? target / dtLimit - (steps - 1) : 0;
    for (let j = 0; j < cells; j++) eta[j] = before[j] + fraction * (after[j] - before[j]);
    time = target;
  }

  function at(fraction) {
    const j = Math.max(0, Math.min(cells - 1, fraction * cells - .5));
    const left = Math.floor(j);
    return eta[left] + (eta[Math.min(cells - 1, left + 1)] - eta[left]) * (j - left);
  }

  return { settings, cells, dx, dtLimit, sourceSpeed, eta, at, advanceTo, get time() { return time; } };
}

export function estimates(settings) {
  const speed = Math.sqrt(G * settings.depth);
  const beachLength = settings.length * (1 - settings.beachStart / 100);
  const relativeDepth = settings.depth / (speed * settings.period);
  const gaugeRange = settings.length * settings.gauge / 100;
  let timeToGauge = 0;
  for (let i = 0; i < 200; i++) timeToGauge += gaugeRange / 200 / Math.sqrt(G * depthAt(settings, (i + .5) * gaugeRange / 200));
  return {
    speed, relativeDepth, gaugeRange, timeToGauge,
    slope: beachLength / (settings.depth - settings.endDepth),
    gaugeDepth: depthAt(settings, gaugeRange),
  };
}
