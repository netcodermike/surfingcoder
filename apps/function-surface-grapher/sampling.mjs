const maxCurveRefinements = 12;
const maxSurfaceRefinements = 5;

function midpointFits(start, middle, end, tolerance) {
  // Scale before subtracting so very large finite values can still be compared.
  const deviation = Math.abs(middle / 2 - (start / 4 + end / 4));
  const change = Math.abs(end / 2 - start / 2);
  const roundoff = Number.EPSILON * Math.max(Math.abs(start), Math.abs(middle), Math.abs(end)) * 4;
  return deviation <= tolerance + .27 * change + roundoff;
}

function clipSegment(x0, y0, x1, y1, min, max) {
  if ((y0 < min && y1 < min) || (y0 > max && y1 > max)) return null;

  function clipPoint(x, y) {
    if (y >= min && y <= max) return [x, y];
    const boundary = y < min ? min : max;
    const difference = y1 - y0;
    const fraction = Number.isFinite(difference)
      ? (boundary - y0) / difference
      : (boundary / 2 - y0 / 2) / (y1 / 2 - y0 / 2);
    return [x0 + fraction * (x1 - x0), boundary];
  }

  return [clipPoint(x0, y0), clipPoint(x1, y1)];
}

export function sampleCurve(evaluate, domain, steps = 960) {
  const { xmin, xmax, ymin, ymax } = domain;
  const paths = [];
  const tolerance = (ymax - ymin) / 1000;
  let remainingRefinements = 8 * steps;
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
    const middleX = x0 + (x1 - x0) / 2;
    const middleY = sample(middleX);
    const finite = [y0, middleY, y1].filter(Number.isFinite).length;
    if (finite === 3) {
      // Use the local change as well as the viewport span so small poles
      // don't pass the continuity check just because the y-axis is wide.
      const change = Math.max(Math.abs(y0 / 2 - middleY / 2), Math.abs(y1 / 2 - middleY / 2));
      if (midpointFits(y0, middleY, y1, Math.min(tolerance, .01 * change))) {
        append(x0, y0, x1, y1);
        return;
      }
    }
    if (finite > 0 && refinements > 0 && remainingRefinements > 0 && middleX > x0 && middleX < x1) {
      // Probe steep or partly defined regions. An interval that still looks
      // discontinuous at the refinement limit becomes a gap. Finite sampling
      // can miss narrow features between probes.
      remainingRefinements -= 1;
      trace(x0, y0, middleX, middleY, refinements - 1);
      trace(middleX, middleY, x1, y1, refinements - 1);
    } else {
      path = undefined;
    }
  }

  let x0 = xmin, y0 = sample(xmin);
  for (let i = 1; i <= steps; i++) {
    const x1 = i === steps ? xmax : xmin + (xmax - xmin) * i / steps;
    const y1 = sample(x1);
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
    if (midpointFits(z0, zm, z1, tolerance)) return true;
    if (!refinements) return false;
    const left = (t0 + tm) / 2;
    const right = (tm + t1) / 2;
    return check(t0, z0, tm, zm, left, sample(left), refinements - 1)
      && check(tm, zm, t1, z1, right, sample(right), refinements - 1);
  }
  return check(0, start.z, 1, end.z, .5, center, maxSurfaceRefinements);
}

export function surfaceCells(evaluate, domain, samples) {
  const { xmin, xmax, ymin, ymax } = domain;
  const points = samples.map(row => row.map(({ x, y, z }) => ({
    x: xmin + (x + 1) * (xmax - xmin) / 2,
    y: ymin + (y + 1) * (ymax - ymin) / 2,
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
