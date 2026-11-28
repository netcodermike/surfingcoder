export const HALF_SCREEN_MM = 10;
export const SCREEN_DISTANCE_MM = 1000;
export const SLIT_WIDTH_NM = 80;
export const BIN_COUNT = 100;
export const BIN_WIDTH_MM = 2 * HALF_SCREEN_MM / BIN_COUNT;
const CELLS_PER_BIN = 24;
const CELL_COUNT = BIN_COUNT * CELLS_PER_BIN;
const CELL_WIDTH_MM = BIN_WIDTH_MM / CELLS_PER_BIN;

function sinc(value) {
  return value === 0 ? 1 : Math.sin(value) / value;
}

export function intensity(position, { wavelength, separation, mode }) {
  const sinAngle = position / Math.hypot(SCREEN_DISTANCE_MM, position);
  const aperture = sinc(Math.PI * SLIT_WIDTH_NM * sinAngle / wavelength);
  if (mode === 'single') return aperture ** 2;
  if (mode === 'distinguished') return 2 * aperture ** 2;
  const phase = Math.PI * separation * 1000 * sinAngle / wavelength;
  return 4 * (aperture * Math.cos(phase)) ** 2;
}

export function fringeSpacing({ wavelength, separation, mode }) {
  return mode === 'coherent' ? SCREEN_DISTANCE_MM * wavelength / (separation * 1000) : null;
}

export function makeDistribution(settings) {
  const cumulative = new Float64Array(CELL_COUNT + 1);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const center = (cell + .5) * CELL_WIDTH_MM - HALF_SCREEN_MM;
    cumulative[cell + 1] = cumulative[cell] + intensity(center, settings) * CELL_WIDTH_MM;
  }
  const area = cumulative[CELL_COUNT];
  return {
    area,
    density(position) { return intensity(position, settings) / area; },
    sample(random) {
      const mass = random() * area;
      let lower = 0;
      let upper = CELL_COUNT;
      while (upper - lower > 1) {
        const middle = (upper + lower) >>> 1;
        if (cumulative[middle] <= mass) lower = middle;
        else upper = middle;
      }
      const portion = (mass - cumulative[lower]) / (cumulative[upper] - cumulative[lower]);
      return (lower + portion) * CELL_WIDTH_MM - HALF_SCREEN_MM;
    },
  };
}
