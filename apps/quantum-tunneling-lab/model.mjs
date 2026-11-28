const DX = 1 / 16;
const DT = .018;
const DOMAIN = 96;
const COUNT = 2 * DOMAIN / DX;
const PACKET_CENTER = -13;
const PACKET_SIGMA = 1.7;

export const presets = Object.freeze({
  tunneling: Object.freeze({ energy: .80, height: 1.15, width: 1.25 }),
  thin: Object.freeze({ energy: .60, height: 1.85, width: .50 }),
  above: Object.freeze({ energy: 1.80, height: .85, width: 1.75 }),
});

// Transmission for a stationary wave incident on a rectangular barrier.
// The E = V limit keeps the expression continuous as the interior wave number tends to zero.
export function planeTransmission({ energy, height, width }) {
  const excess = energy - height;
  if (Math.abs(excess) < 1e-9) return 1 / (1 + energy * width * width / 2);
  const argument = Math.sqrt(2 * Math.abs(excess)) * width;
  const oscillation = excess > 0 ? Math.sin(argument) : Math.sinh(argument);
  return 1 / (1 + (height * oscillation) ** 2 / (4 * energy * Math.abs(excess)));
}

export function createPacket({ energy, height, width }) {
  if (![energy, height, width].every(Number.isFinite) || energy <= 0 || height < 0 || width <= 0) {
    throw new RangeError('Use positive energy and width with a nonnegative barrier height.');
  }

  const x0 = -DOMAIN + DX / 2;
  const barrierLeft = Math.ceil((-width / 2 - x0) / DX);
  const barrierRight = Math.ceil((width / 2 - x0) / DX);
  const stepLimit = Math.ceil((Math.abs(PACKET_CENTER) + width / 2 + 17) / Math.sqrt(2 * energy) / DT);
  const carrier = Math.sqrt(2 * energy);
  let real = new Float64Array(COUNT);
  let imag = new Float64Array(COUNT);
  let nextReal = new Float64Array(COUNT);
  let nextImag = new Float64Array(COUNT);
  let steps = 0;

  // For H = -(1/2)∂²/∂x² + V, solve
  // (I + i dt H/2) ψ(t+dt) = (I - i dt H/2) ψ(t).
  // The potential is fixed for a run, so factor the left-hand tridiagonal matrix once.
  const offDiagonal = -DT / (4 * DX ** 2);
  const diagonal = new Float64Array(COUNT);
  const inverseReal = new Float64Array(COUNT);
  const inverseImag = new Float64Array(COUNT);
  const upperReal = new Float64Array(COUNT);
  const upperImag = new Float64Array(COUNT);

  let norm = 0;
  for (let i = 0; i < COUNT; i++) {
    const x = x0 + i * DX;
    const distance = (x - PACKET_CENTER) / (2 * PACKET_SIGMA);
    const amplitude = Math.exp(-distance * distance);
    real[i] = amplitude * Math.cos(carrier * (x - PACKET_CENTER));
    imag[i] = amplitude * Math.sin(carrier * (x - PACKET_CENTER));
    norm += amplitude * amplitude * DX;

    const inBarrier = i >= barrierLeft && i < barrierRight;
    diagonal[i] = DT / 2 * (1 / (DX * DX) + (inBarrier ? height : 0));
    const pivotReal = i === 0 ? 1 : 1 + offDiagonal * upperImag[i - 1];
    const pivotImag = i === 0 ? diagonal[i] : diagonal[i] - offDiagonal * upperReal[i - 1];
    const denominator = pivotReal ** 2 + pivotImag ** 2;
    inverseReal[i] = pivotReal / denominator;
    inverseImag[i] = -pivotImag / denominator;
    upperReal[i] = -offDiagonal * inverseImag[i];
    upperImag[i] = offDiagonal * inverseReal[i];
  }

  const scale = 1 / Math.sqrt(norm);
  for (let i = 0; i < COUNT; i++) {
    real[i] *= scale;
    imag[i] *= scale;
  }

  function step() {
    let processedReal = 0;
    let processedImag = 0;
    for (let i = 0; i < COUNT; i++) {
      const before = i - 1, after = i + 1;
      const neighborImag = (imag[before] ?? 0) + (imag[after] ?? 0);
      const neighborReal = (real[before] ?? 0) + (real[after] ?? 0);
      const rhsReal = real[i] + diagonal[i] * imag[i] + offDiagonal * (neighborImag + processedImag);
      const rhsImag = imag[i] - diagonal[i] * real[i] - offDiagonal * (neighborReal + processedReal);
      processedReal = rhsReal * inverseReal[i] - rhsImag * inverseImag[i];
      processedImag = rhsReal * inverseImag[i] + rhsImag * inverseReal[i];
      nextReal[i] = processedReal;
      nextImag[i] = processedImag;
    }
    for (let i = COUNT - 2; i >= 0; i--) {
      const neighborReal = nextReal[i + 1], neighborImag = nextImag[i + 1];
      nextReal[i] -= upperReal[i] * neighborReal - upperImag[i] * neighborImag;
      nextImag[i] -= upperReal[i] * neighborImag + upperImag[i] * neighborReal;
    }
    [real, nextReal] = [nextReal, real];
    [imag, nextImag] = [nextImag, imag];
    steps++;
  }

  function probabilities() {
    let left = 0, inside = 0, right = 0;
    for (let i = 0; i < barrierLeft; i++) left += density(i);
    for (let i = barrierLeft; i < barrierRight; i++) inside += density(i);
    for (let i = barrierRight; i < COUNT; i++) right += density(i);
    return { left: left * DX, inside: inside * DX, right: right * DX };
  }

  function density(index) { return real[index] ** 2 + imag[index] ** 2; }

  return {
    dx: DX, dt: DT, size: COUNT, x0,
    get time() { return steps * DT; },
    get finished() { return steps >= stepLimit; },
    get duration() { return stepLimit * DT; },
    density, probabilities,
    advance(count = 1) {
      const end = Math.min(stepLimit, steps + count);
      while (steps < end) step();
    },
  };
}
