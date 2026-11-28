const inverseRootTwo = 1 / Math.sqrt(2);
const radiansPerDegree = Math.PI / 180;

export const presetAngles = Object.freeze({
  tilted: [62, 55],
  zero: [0, 0],
  one: [180, 0],
  plus: [90, 0],
  minus: [90, 180],
  plusI: [90, 90],
  minusI: [90, 270],
});

const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (value, factor) => value.map(part => part * factor);
const multiply = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
const polar = (radians, radius = 1) => [radius * Math.cos(radians), radius * Math.sin(radians)];
const normSquared = ([real, imaginary]) => real ** 2 + imaginary ** 2;

export function fromAngles(theta, phi) {
  const halfPolar = theta * radiansPerDegree / 2;
  return [[Math.cos(halfPolar), 0], polar(phi * radiansPerDegree, Math.sin(halfPolar))];
}

export function applyGate([a, b], gate) {
  switch (gate) {
    case 'X': return [b, a];
    case 'Y': return [multiply([0, -1], b), multiply([0, 1], a)];
    case 'Z': return [a, scale(b, -1)];
    case 'H': return [scale(add(a, b), inverseRootTwo), scale(add(a, scale(b, -1)), inverseRootTwo)];
    case 'S': return [a, multiply([0, 1], b)];
    case 'T': return [a, multiply(polar(Math.PI / 4), b)];
    default: throw new RangeError('Unknown gate ' + gate);
  }
}

export function bloch([a, b]) {
  const [real, imaginary] = multiply([a[0], -a[1]], b);
  const z = normSquared(a) - normSquared(b);
  return [2 * real, 2 * imaginary, z];
}

export function stateAngles(state) {
  const [x, y, z] = bloch(state);
  return {
    theta: Math.atan2(Math.hypot(x, y), z) / radiansPerDegree,
    phi: Math.hypot(x, y) < 1e-12 ? null : ((Math.atan2(y, x) / radiansPerDegree) + 360) % 360,
  };
}

export function canonicalState([a, b]) {
  const reference = normSquared(a) > 1e-20 ? a : b;
  const rotation = polar(-Math.atan2(reference[1], reference[0]));
  return [multiply(a, rotation), multiply(b, rotation)];
}

const basisIndexes = { X: 0, Y: 1, Z: 2 };

export function probability(state, basis) {
  if (!Object.hasOwn(basisIndexes, basis)) throw new RangeError('Unknown measurement basis ' + basis);
  const component = bloch(state)[basisIndexes[basis]];
  const chance = Math.max(0, Math.min(1, (1 + component) / 2));
  if (chance < 1e-12) return 0;
  if (chance > 1 - 1e-12) return 1;
  return chance;
}

export function sample(state, basis, shots, random = Math.random) {
  const chance = probability(state, basis);
  let positive = 0;
  for (let index = 0; index < shots; index++) {
    if (random() < chance) positive++;
  }
  return [positive, shots - positive];
}
