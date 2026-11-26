const maxCurveRefinements = 12;
const maxCurveSplitsPerInterval = 48;
const maxSurfaceRefinements = 5;
const offsetProbe = (3 - Math.sqrt(5)) / 2;

export function gridCoordinate(min, max, index, steps) {
  return index === steps ? max : min + (max - min) * index / steps;
}

function pointFits(start, middle, end, tolerance, fraction = .5) {
  // Scale before subtracting so very large finite values can still be compared.
  const expected = (1 - fraction) * (start / 2) + fraction * (end / 2);
  const deviation = Math.abs(middle / 2 - expected);
  const change = Math.abs(end / 2 - start / 2);
  const roundoff = Number.EPSILON * Math.max(Math.abs(start), Math.abs(middle), Math.abs(end)) * 4;
  return deviation <= tolerance + .27 * change + roundoff;
}

function clipSegment(x0, y0, x1, y1, min, max) {
  if ((y0 < min && y1 < min) || (y0 > max && y1 > max)) return null;
  const scale = Number.isFinite(y1 - y0) ? 1 : .5;
  const difference = y1 * scale - y0 * scale;

  function clipPoint(x, y) {
    if (y >= min && y <= max) return [x, y];
    const boundary = y < min ? min : max;
    const fraction = (boundary * scale - y0 * scale) / difference;
    if (fraction <= .5) return [x0 + fraction * (x1 - x0), boundary];
    // Interpolate from the closer endpoint to preserve tiny visible spans.
    const reverse = (y1 * scale - boundary * scale) / difference;
    return [x1 - reverse * (x1 - x0), boundary];
  }

  return [clipPoint(x0, y0), clipPoint(x1, y1)];
}

export function sampleCurve(evaluate, domain, steps = 960) {
  const { xmin, xmax, ymin, ymax } = domain;
  const paths = [];
  const tolerance = (ymax - ymin) / 1000;
  let remainingSplits;
  let path, hasFiniteSamples = false;

  function sample(x) {
    const y = evaluate(x);
    hasFiniteSamples ||= Number.isFinite(y);
    return y;
  }

  function append(x0, y0, x1, y1) {
    const segment = clipSegment(x0, y0, x1, y1, ymin, ymax);
    if (!segment) {
      path = undefined;
      return;
    }
    const [start, end] = segment;
    const last = path?.at(-1);
    if (last?.[0] === start[0] && last[1] === start[1]) {
      path.push(end);
    } else {
      path = [start, end];
      paths.push(path);
    }
  }

  function trace(x0, y0, x1, y1, refinements) {
    const width = x1 - x0;
    const middleX = x0 + width / 2;
    const middleY = sample(middleX);
    const finite = [y0, middleY, y1].filter(Number.isFinite).length;
    if (finite === 3) {
      // Use the local change as well as the viewport span so small poles
      // don't pass the continuity check just because the y-axis is wide.
      const change = Math.max(Math.abs(y0 / 2 - middleY / 2), Math.abs(y1 / 2 - middleY / 2));
      const localTolerance = Math.min(tolerance, .01 * change);
      if (pointFits(y0, middleY, y1, localTolerance, (middleX - x0) / width)) {
        const offsetX = x0 + width * offsetProbe;
        const offsetY = sample(offsetX);
        if (Number.isFinite(offsetY) &&
            pointFits(y0, offsetY, y1, localTolerance, (offsetX - x0) / width)) {
          append(x0, y0, x1, y1);
          return;
        }
      }
    }
    if (refinements > 0 && remainingSplits > 0 && middleX > x0 && middleX < x1 &&
        (finite > 0 || Number.isFinite(sample(x0 + width * offsetProbe)))) {
      // Probe steep or partly defined regions. An interval that still looks
      // discontinuous at the refinement limit becomes a gap. Finite sampling
      // can miss narrow features between probes.
      remainingSplits -= 1;
      trace(x0, y0, middleX, middleY, refinements - 1);
      trace(middleX, middleY, x1, y1, refinements - 1);
    } else {
      path = undefined;
    }
  }

  let x0 = xmin, y0 = sample(xmin);
  for (let i = 1; i <= steps; i++) {
    const x1 = gridCoordinate(xmin, xmax, i, steps);
    const y1 = sample(x1);
    // A rough interval must not exhaust the probes for the rest of the curve.
    remainingSplits = maxCurveSplitsPerInterval;
    trace(x0, y0, x1, y1, maxCurveRefinements);
    x0 = x1;
    y0 = y1;
  }
  return { paths, hasFiniteSamples };
}

function continuousTransect(evaluate, start, end, minimumTolerance) {
  const xSpan = end.x - start.x;
  const ySpan = end.y - start.y;
  const sample = t => evaluate(start.x + t * xSpan, start.y + t * ySpan);
  const center = sample(.5);
  if (!Number.isFinite(center)) return false;

  const change = Math.max(Math.abs(start.z / 2 - center / 2), Math.abs(end.z / 2 - center / 2));
  const tolerance = minimumTolerance + .002 * change;
  function check(t0, z0, t1, z1, tm, zm, refinements) {
    if (!Number.isFinite(zm)) return false;
    if (pointFits(z0, zm, z1, tolerance, (tm - t0) / (t1 - t0))) return true;
    if (!refinements) return false;
    const left = (t0 + tm) / 2;
    const right = (tm + t1) / 2;
    return check(t0, z0, tm, zm, left, sample(left), refinements - 1)
      && check(tm, zm, t1, z1, right, sample(right), refinements - 1);
  }
  return check(0, start.z, 1, end.z, .5, center, maxSurfaceRefinements);
}

export function needsFinerSurface(evaluate, domain, samples) {
  const { xmin, xmax, ymin, ymax } = domain;
  const rows = samples.length - 1, cols = samples[0].length - 1;
  let low = Infinity, high = -Infinity;
  for (const row of samples) {
    for (const { z } of row) {
      if (!Number.isFinite(z)) continue;
      low = Math.min(low, z);
      high = Math.max(high, z);
    }
  }
  if (!Number.isFinite(low)) return false;

  const halfSpan = high / 2 - low / 2;
  const roundoff = Number.EPSILON * Math.max(Math.abs(low), Math.abs(high)) * 16;
  const tolerance = .045 * halfSpan + roundoff;
  const limit = Math.max(3, Math.ceil(rows * cols / 48));
  let deviations = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const a = samples[row][col].z, b = samples[row][col + 1].z;
      const c = samples[row + 1][col + 1].z, d = samples[row + 1][col].z;
      if (![a, b, c, d].every(Number.isFinite)) continue;
      // Check the interior off the corner lattice as well as the cell center.
      for (const [u, v] of [[.5, .5], [offsetProbe, 1 - offsetProbe]]) {
        const x = gridCoordinate(xmin, xmax, col + u, cols);
        const y = gridCoordinate(ymin, ymax, row + v, rows);
        const z = evaluate(x, y);
        if (!Number.isFinite(z)) {
          if (++deviations >= limit) return true;
          break;
        }
        const expected = (1 - v) * ((1 - u) * (a / 2) + u * (b / 2)) +
          v * ((1 - u) * (d / 2) + u * (c / 2));
        const difference = Math.abs(z / 2 - expected);
        if (difference > 4 * tolerance) return true;
        if (difference > tolerance) {
          if (++deviations >= limit) return true;
          break;
        }
      }
    }
  }
  return false;
}

export function surfaceCells(evaluate, domain, samples) {
  const { xmin, xmax, ymin, ymax } = domain;
  const points = samples.map((row, i) => row.map(({ z }, j) => ({
    x: gridCoordinate(xmin, xmax, j, row.length - 1),
    y: gridCoordinate(ymin, ymax, i, samples.length - 1),
    z,
  })));
  const cells = [];
  for (let row = 0; row < points.length - 1; row++) {
    for (let col = 0; col < points[row].length - 1; col++) {
      const a = points[row][col], b = points[row][col + 1];
      const c = points[row + 1][col + 1], d = points[row + 1][col];
      if (![a, b, c, d].every(point => Number.isFinite(point.z))) continue;
      // Checking edges and diagonals catches many poles and holes missed by
      // the corner grid. A bounded set of probes can miss narrow discontinuities.
      const transects = [[a, b], [b, c], [c, d], [d, a], [a, c], [b, d]];
      const roundoff = Number.EPSILON * Math.max(Math.abs(a.z), Math.abs(b.z), Math.abs(c.z), Math.abs(d.z)) * 16;
      if (transects.every(([start, end]) => continuousTransect(evaluate, start, end, roundoff))) {
        cells.push([row, col]);
      }
    }
  }
  return cells;
}
