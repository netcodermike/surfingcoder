import { gridCoordinate } from './sampling.mjs?v=1.1.3';

const curveSteps = 960;
const maxCurveProbes = 16_000;
const maxCurveMarkers = 192;
const golden = (Math.sqrt(5) - 1) / 2;

function difference(a, b) {
  const delta = a - b;
  return Number.isFinite(delta) ? delta : a / 2 - b / 2;
}

function sign(a, b) {
  const tolerance = 8 * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= tolerance ? 0 : a < b ? -1 : 1;
}

function* pairs(series) {
  for (let first = 0; first < series.length; first++) {
    for (let second = first + 1; second < series.length; second++) {
      yield [series[first], series[second]];
    }
  }
}

function* sharedCurveSpans(first, second) {
  let i = 0, j = 0;
  while (i < first.length && j < second.length) {
    const endA = first[i].at(-1)[0], endB = second[j].at(-1)[0];
    const left = Math.max(first[i][0][0], second[j][0][0]);
    const right = Math.min(endA, endB);
    if (left <= right) yield [left, right];
    if (endA <= endB) i++;
    if (endB <= endA) j++;
  }
}

function refineCrossing(left, right, at) {
  const width = right.x - left.x;
  const scale = Math.max(Math.abs(left.delta), Math.abs(right.delta));
  // A root can lie between two representable x values. Allow the residual
  // implied by rounding x, using the original bracket as the local slope scale.
  const xRoundoff = Number.EPSILON * Math.max(Math.abs(left.x), Math.abs(right.x), width);
  const tolerance = scale * Math.min(1 / 64, 32 * Number.EPSILON + 16 * xRoundoff / width);
  for (let i = 0; i < 58; i++) {
    const x = left.x + (right.x - left.x) / 2;
    if (x <= left.x || x >= right.x) break;
    const middle = at(x);
    if (!middle) return null;
    if (!middle.sign) return middle;
    if (middle.sign === left.sign) left = middle;
    else right = middle;
  }
  // Require convergence on both sides. One close value can also occur beside a jump.
  if (Math.max(Math.abs(left.delta), Math.abs(right.delta)) > tolerance) return null;
  return Math.abs(left.delta) <= Math.abs(right.delta) ? left : right;
}

function crossingBesideZero(zero, other, at) {
  const width = Math.abs(other.x - zero.x);
  const direction = Math.sign(other.x - zero.x);
  let offset = 8 * Number.EPSILON * Math.max(Math.abs(zero.x), Math.abs(other.x), width);
  // Check the sign just inside the interval. A second crossing can occur
  // before the next grid sample, even when the first endpoint is a root.
  for (let i = 0; i < 10 && offset < width; i++, offset *= 4) {
    const inside = at(zero.x + direction * offset);
    if (!inside) return null;
    if (!inside.sign) continue;
    if (inside.sign === other.sign) return null;
    return direction > 0 ? refineCrossing(inside, other, at) : refineCrossing(other, inside, at);
  }
  return null;
}

function refineExtremum(left, seed, right, at) {
  const tolerance = 1e-10 * Math.max(Math.abs(left.delta), Math.abs(right.delta));
  const score = point => seed.sign * point.delta;
  let low = left.x, high = right.x, best = seed;
  let a = at(high - golden * (high - low));
  let b = at(low + golden * (high - low));
  for (let i = 0; i < 44; i++) {
    if (!a || !b) return [];
    for (const point of [a, b]) {
      if (score(point) < score(best)) best = point;
    }
    if (a.x <= low || b.x >= high || a.x >= b.x) break;
    if (score(a) <= score(b)) {
      high = b.x;
      b = a;
      a = at(high - golden * (high - low));
    } else {
      low = a.x;
      a = b;
      b = at(low + golden * (high - low));
    }
  }
  if (!best.sign || (best.sign === seed.sign && Math.abs(best.delta) <= tolerance)) return [best];
  if (best.sign === seed.sign) return [];
  // Two crossings can surround an extremum between samples of the same sign.
  return [refineCrossing(left, best, at), refineCrossing(best, right, at)];
}

export function findCurveIntersections(series, domain) {
  const { xmin, xmax, ymin, ymax } = domain;
  const points = [], overlaps = [], overlapPaths = [];
  let limited = false;
  for (const [first, second] of pairs(series)) {
    const pair = [first.index, second.index];
    let budget = maxCurveProbes;
    const candidates = [];
    const overlapStart = overlapPaths.length;
    const at = x => {
      if (budget-- <= 0) return null;
      const a = first.evaluate(x), b = second.evaluate(x);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      const gap = b - a;
      const y = Number.isFinite(gap) ? a + gap / 2 : a / 2 + b / 2;
      return { x, y, delta: difference(a, b), sign: sign(a, b) };
    };
    const marker = point => {
      if (point && point.y >= ymin && point.y <= ymax && candidates.length < maxCurveMarkers) {
        candidates.push({ x: point.x, y: point.y, pair });
      }
    };

    for (const [left, right] of sharedCurveSpans(first.paths, second.paths)) {
      if (budget <= 0) break;
      if (right === left) {
        const point = at(left);
        if (point?.sign === 0) marker(point);
        continue;
      }
      const steps = Math.max(2, Math.ceil(curveSteps * ((right - left) / (xmax - xmin))));
      const samples = Array.from({length: steps + 1}, (_, i) => at(gridCoordinate(left, right, i, steps)));
      const inOverlap = new Set();
      let shared;
      for (let i = 1; i < samples.length; i++) {
        const a = samples[i - 1], b = samples[i];
        const middle = a?.sign === 0 && b?.sign === 0 && b.x > a.x ? at(a.x + (b.x - a.x) / 2) : null;
        if (middle?.sign === 0) {
          if (!shared) {
            shared = [{ x: a.x, y: a.y }];
            overlapPaths.push({ pair, points: shared });
          }
          shared.push({ x: b.x, y: b.y });
          inOverlap.add(i - 1);
          inOverlap.add(i);
        } else {
          shared = undefined;
          if (a && b && a.sign !== b.sign && candidates.length < maxCurveMarkers) {
            if (!a.sign) marker(crossingBesideZero(a, b, at));
            else if (!b.sign) marker(crossingBesideZero(b, a, at));
            else marker(refineCrossing(a, b, at));
          }
        }
      }
      for (let i = 0; i < samples.length && candidates.length < maxCurveMarkers; i++) {
        const current = samples[i];
        if (!current || inOverlap.has(i)) continue;
        if (!current.sign) {
          marker(current);
          continue;
        }
        const a = samples[i - 1], b = samples[i + 1];
        if (a?.sign === current.sign && b?.sign === current.sign &&
            Math.abs(current.delta) < Math.abs(a.delta) && Math.abs(current.delta) <= Math.abs(b.delta)) {
          for (const contact of refineExtremum(a, current, b, at)) marker(contact);
        }
      }
    }
    limited ||= budget <= 0 || candidates.length === maxCurveMarkers;
    if (overlapPaths.length > overlapStart) overlaps.push(pair);
    candidates.sort((a, b) => a.x - b.x);
    let previous;
    for (const candidate of candidates) {
      const tolerance = 32 * Number.EPSILON * Math.max(xmax - xmin, Math.abs(candidate.x));
      if (previous && candidate.x - previous.x <= tolerance) continue;
      points.push(candidate);
      previous = candidate;
    }
  }
  return { points, overlaps, overlapPaths, limited };
}

function lerp(a, b, t) {
  return (1 - t) * a + t * b;
}

function interpolatedContact(a, b) {
  let left = Math.abs(a.z - a.otherZ), right = Math.abs(b.z - b.otherZ);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    left = Math.abs(a.z / 2 - a.otherZ / 2);
    right = Math.abs(b.z / 2 - b.otherZ / 2);
  }
  const maximum = Math.max(left, right);
  const t = (left / maximum) / (left / maximum + right / maximum);
  const id = [a.id, b.id].sort().join('~');
  return { id, point: [lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t)] };
}

const surfaceDirections = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const contactResolution = 2 ** -38;

function surfaceBend(center, ring, gap) {
  if (ring.some(probe => !probe)) return null;
  const scale = Math.max(Math.abs(gap(center)), ...ring.map(probe => Math.abs(gap(probe))));
  if (!scale) return null;
  const [nw, n, ne, w, e, sw, s, se] = ring.map(probe => gap(probe) / scale);
  const middle = gap(center) / scale;
  const xx = w + e - 2 * middle, yy = n + s - 2 * middle;
  const xy = (nw + se - ne - sw) / 4;
  const determinant = xx * yy - xy * xy;
  if (xx <= 0 || yy <= 0 || determinant <= 1e-8 * xx * yy) return null;
  return { xx, yy, xy, determinant, dx: (e - w) / 2, dy: (s - n) / 2 };
}

function refineSurfaceContact(seed, bounds, at, variation) {
  const { top, bottom, left, right } = bounds;
  const gap = sample => seed.sign * sample.delta;
  // Search in grid coordinates so the step is comparable on axes with different scales.
  function* neighbors(center, step) {
    for (const [dr, dc] of surfaceDirections) {
      const row = Math.max(top, Math.min(bottom, center.row + dr * step));
      const col = Math.max(left, Math.min(right, center.col + dc * step));
      if (row !== center.row || col !== center.col) yield at(row, col);
    }
  }
  const fits = (center, step) => center.row - top >= step && bottom - center.row >= step &&
    center.col - left >= step && right - center.col >= step;
  let best = seed, step = .5;
  // A local quadratic estimate gives narrow or tilted minima a better starting point.
  const radius = 1 / 4;
  if (fits(seed, radius)) {
    const bend = surfaceBend(seed, [...neighbors(seed, radius)], gap);
    if (bend) {
      const { xx, yy, xy, determinant, dx, dy } = bend;
      const col = seed.col + radius * (xy * dy - yy * dx) / determinant;
      const row = seed.row + radius * (xy * dx - xx * dy) / determinant;
      if (row >= top && row <= bottom && col >= left && col <= right) {
        const estimate = at(row, col);
        if (estimate && estimate.sign !== -seed.sign && gap(estimate) < gap(best)) best = estimate;
      }
    }
  }
  for (let i = 0; i < 112 && step > contactResolution; i++) {
    let next = best;
    for (const probe of neighbors(best, step)) {
      if (!probe || probe.sign === -seed.sign) return null;
      if (gap(probe) < gap(next)) next = probe;
    }
    if (next === best) step /= 2;
    else best = next;
  }
  // A zero-height tangent may need to be rounded in x and y, leaving a
  // quadratic residual even though the search reached the contact.
  const tolerance = variation * (8 * contactResolution) ** 2;
  if (best.sign && (step > contactResolution || gap(best) > tolerance)) return null;
  const checkRadius = 1 / 32;
  const ring = [...neighbors(best, checkRadius)];
  if (ring.some(probe => !probe || probe.sign !== seed.sign || gap(probe) <= tolerance)) return null;
  // On a full stencil, check mixed curvature as well as axis curvature.
  // A tilted ridge can rise along every sampled direction and still have no isolated minimum.
  if (fits(best, checkRadius) && !surfaceBend(best, ring, gap)) return null;
  return best;
}

export function findSurfaceIntersections(series, domain) {
  const { xmin, xmax, ymin, ymax } = domain;
  const segments = [], overlaps = [], points = [];
  for (const [first, second] of pairs(series)) {
    const pair = [first.index, second.index];
    const rows = first.samples.length, cols = first.samples[0].length;
    if (second.samples.length !== rows || second.samples[0].length !== cols) {
      throw Error('Surface intersection meshes must use a shared grid.');
    }
    const secondCells = new Set(second.cells.map(cell => cell.join(',')));
    const sharedCells = new Set();
    const vertices = new Map();
    const edges = new Set();
    const isolated = new Map();
    const verticesOnSegments = new Set();
    let hasCoincidence = false, hasDistinct = false;
    function location(row, col) {
      return { x: gridCoordinate(xmin, xmax, col, cols - 1),
        y: gridCoordinate(ymin, ymax, row, rows - 1) };
    }
    function sample(row, col, { x, y }, z, otherZ) {
      return { row, col, id: row + ',' + col, x, y, z, otherZ, sign: sign(z, otherZ), delta: difference(z, otherZ) };
    }
    function vertex(row, col) {
      const id = row + ',' + col;
      if (!vertices.has(id)) {
        vertices.set(id, sample(row, col, location(row, col), first.samples[row][col].z, second.samples[row][col].z));
      }
      return vertices.get(id);
    }
    function at(row, col) {
      const { x, y } = location(row, col);
      const z = first.evaluate(x, y), otherZ = second.evaluate(x, y);
      return Number.isFinite(z) && Number.isFinite(otherZ) ? sample(row, col, { x, y }, z, otherZ) : null;
    }
    function contour(triangle) {
      if (triangle.every(p => !p.sign)) {
        hasCoincidence = true;
        return;
      }
      hasDistinct = true;
      const contacts = [];
      for (let i = 0; i < triangle.length; i++) {
        const a = triangle[i], b = triangle[(i + 1) % triangle.length];
        if (!a.sign) contacts.push({ id: a.id, point: [a.x, a.y, a.z] });
        else if (b.sign && a.sign !== b.sign) contacts.push(interpolatedContact(a, b));
      }
      if (contacts.length === 1) {
        isolated.set(contacts[0].id, contacts[0].point);
      } else if (contacts.length === 2) {
        const id = contacts.map(contact => contact.id).sort().join('|');
        if (edges.has(id)) return;
        edges.add(id);
        for (const contact of contacts) verticesOnSegments.add(contact.id);
        segments.push({ pair, points: contacts.map(contact => contact.point) });
      }
    }
    for (const [row, col] of first.cells) {
      const id = row + ',' + col;
      if (!secondCells.has(id)) continue;
      sharedCells.add(id);
      const a = vertex(row, col), b = vertex(row, col + 1);
      const c = vertex(row + 1, col + 1), d = vertex(row + 1, col);
      contour([a, b, c]);
      contour([a, c, d]);
    }
    if (hasCoincidence && !hasDistinct) overlaps.push(pair);
    for (const [id, point] of isolated) {
      if (!verticesOnSegments.has(id)) points.push({ pair, point });
    }
    const contacts = [];
    for (const seed of vertices.values()) {
      if (!seed.sign) continue;
      const { row, col } = seed;
      const bounds = { top: Math.max(0, row - 1), bottom: Math.min(rows - 1, row + 1),
        left: Math.max(0, col - 1), right: Math.min(cols - 1, col + 1) };
      // Only refine when the full neighborhood is drawable on both meshes.
      const neighbors = [];
      let drawable = true;
      for (let r = bounds.top; r <= bounds.bottom; r++) {
        for (let c = bounds.left; c <= bounds.right; c++) {
          if (r < bounds.bottom && c < bounds.right && !sharedCells.has(r + ',' + c)) drawable = false;
          if (r !== row || c !== col) neighbors.push(vertices.get(r + ',' + c));
        }
      }
      if (!drawable || neighbors.some(probe => probe?.sign !== seed.sign || seed.sign * probe.delta < Math.abs(seed.delta))) continue;
      const variation = Math.max(...neighbors.map(probe => Math.abs(probe.delta) - Math.abs(seed.delta)));
      if (!(variation > 0) || Math.abs(seed.delta) > variation) continue;
      const contact = refineSurfaceContact(seed, bounds, at, variation);
      if (!contact || contacts.some(p => Math.hypot(p.row - contact.row, p.col - contact.col) < 1e-5)) continue;
      contacts.push(contact);
      points.push({ pair, point: [contact.x, contact.y, contact.z] });
    }
  }
  return { segments, overlaps, points };
}
