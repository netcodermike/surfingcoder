// With light-years and years as coordinates, the speed of light is 1.
function inverseGamma(velocity) {
  if (!Number.isFinite(velocity) || Math.abs(velocity) >= 1) {
    throw new RangeError('Velocity must be between −1c and 1c.');
  }
  return Math.sqrt((1 - velocity) * (1 + velocity));
}

export function trip(distance, speed) {
  if (!Number.isFinite(distance) || distance <= 0 || !(speed > 0)) {
    throw new RangeError('Distance and speed must be positive.');
  }
  const gamma = 1 / inverseGamma(speed);
  const legYears = distance / speed;
  const earthYears = 2 * legYears;
  if (!Number.isFinite(earthYears)) throw new RangeError('Trip duration is too large.');
  return { distance, speed, legYears, earthYears, shipYears: earthYears / gamma, gamma };
}

export function tripAt(distance, speed, earthTime) {
  if (!Number.isFinite(earthTime)) throw new RangeError('Earth time must be finite.');
  const { legYears, earthYears, gamma } = trip(distance, speed);
  const time = Math.max(0, Math.min(earthYears, earthTime));
  // At the instant turnaround, use the inbound inertial frame.
  const returning = time >= legYears;
  const legTime = returning ? earthYears - time : time;
  const position = Math.min(distance, speed * legTime);
  const clockRateSquared = (1 - speed) * (1 + speed);
  const scaledLegTime = legTime * clockRateSquared;
  // The ship-frame simultaneity line through (position, time) meets Earth
  // at t - v*x. The equivalent formulas below avoid cancellation near c.
  const simultaneousEarthTime = returning ? earthYears - scaledLegTime : scaledLegTime;
  return { position, shipTime: time / gamma, velocity: returning ? -speed : speed, simultaneousEarthTime, returning };
}

function subtractBoostProduct(a, b, velocity) {
  const speed = Math.abs(velocity);
  if (speed <= .5) return a - velocity * b;
  const aligned = Math.sign(velocity) * b;
  return (a - aligned) + (1 - speed) * aligned;
}

export function transformEvent({ x, t }, velocity) {
  if (!Number.isFinite(x) || !Number.isFinite(t)) throw new RangeError('Event coordinates must be finite.');
  const scale = inverseGamma(velocity);
  const transformed = { x: subtractBoostProduct(x, t, velocity) / scale, t: subtractBoostProduct(t, x, velocity) / scale };
  if (!Number.isFinite(transformed.x) || !Number.isFinite(transformed.t)) {
    throw new RangeError('Transformed event coordinates are too large.');
  }
  return transformed;
}

export function compareEvents(a, b, velocity) {
  if (![a.x, a.t, b.x, b.t].every(Number.isFinite)) throw new RangeError('Event coordinates must be finite.');
  const dt = b.t - a.t, dx = b.x - a.x;
  if (!Number.isFinite(dt) || !Number.isFinite(dx)) throw new RangeError('Event separation is too large.');
  const timeSpan = Math.abs(dt), distance = Math.abs(dx);
  const difference = timeSpan - distance;
  // Decimal inputs can differ by a few ulps even when they describe a light ray.
  const onCone = Math.abs(difference) <= 4 * Number.EPSILON * Math.max(timeSpan, distance);
  const separation = onCone ? (timeSpan === 0 ? 'coincident' : 'lightlike')
    : (difference > 0 ? 'timelike' : 'spacelike');
  const intervalSquared = onCone ? 0 : difference * (timeSpan + distance);
  if (!Number.isFinite(intervalSquared)) throw new RangeError('Spacetime interval is too large.');
  const frame = transformEvent({ x: onCone ? Math.sign(dx) * timeSpan : dx, t: dt }, velocity);
  const roundoff = 4 * Number.EPSILON * Math.max(timeSpan, Math.abs(velocity * dx)) / inverseGamma(velocity);
  const simultaneous = separation === 'coincident' || (separation === 'spacelike' && Math.abs(frame.t) <= roundoff);
  const orderTime = separation === 'spacelike' ? frame.t : dt;
  const order = simultaneous ? 'simultaneous' : orderTime < 0 ? 'b-first' : 'a-first';
  return { deltaT: simultaneous ? 0 : frame.t, deltaX: frame.x, intervalSquared, separation, order };
}

const lightSpeed = 299_792_458;
const earthRadiusKm = 6371;
const earthGM = 3.986004418e14;
const schwarzschildRadiusKm = 2 * earthGM / lightSpeed ** 2 / 1000;
const microsecondsPerDay = 86_400e6;

export function earthClocks(altitudeKm, orbit = false) {
  if (!Number.isFinite(altitudeKm) || altitudeKm < 0) {
    throw new RangeError('Altitude must be a nonnegative number of kilometres.');
  }
  if (typeof orbit !== 'boolean') throw new TypeError('Choose whether the high clock orbits.');

  const radius = earthRadiusKm + altitudeKm;
  const groundPotential = schwarzschildRadiusKm / earthRadiusKm;
  const highPotential = schwarzschildRadiusKm / radius;
  const groundRate = Math.sqrt(1 - groundPotential);
  const stationaryRate = Math.sqrt(1 - highPotential);
  const highRate = orbit ? Math.sqrt(1 - 1.5 * highPotential) : stationaryRate;

  // Compare Schwarzschild clock rates with a nonrotating surface clock.
  // Use differences of squares to retain small changes near ground level.
  const gravityGap = groundPotential * (altitudeKm / radius);
  const motionGap = orbit ? -.5 * highPotential : 0;
  const netGap = orbit ? groundPotential * ((altitudeKm - earthRadiusKm / 2) / radius) : gravityGap;
  return {
    gravityUsPerDay: microsecondsPerDay * gravityGap / (groundRate * (stationaryRate + groundRate)),
    motionUsPerDay: microsecondsPerDay * motionGap / (groundRate * (highRate + stationaryRate)),
    netUsPerDay: microsecondsPerDay * netGap / (groundRate * (highRate + groundRate)),
    speedKmPerS: orbit ? lightSpeed / 1000 * Math.sqrt(.5 * highPotential / (1 - highPotential)) : 0,
  };
}
