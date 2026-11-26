import { gridCoordinate } from './sampling.mjs';

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
  const tolerance = 32 * Number.EPSILON * Math.max(Math.abs(left.delta), Math.abs(right.delta));
  for (let i = 0; i < 58; i++) {
    const x = left.x + (right.x - left.x) / 2;
    if (x <= left.x || x >= right.x) break;
    const middle = at(x);
    if (!middle) return null;
    if (!middle.sign) return middle;
    if (middle.sign === left.sign) left = middle;
    else right = middle;
  }
  const best = Math.abs(left.delta) <= Math.abs(right.delta) ? left : right;
  // A sign change alone is also consistent with a jump or pole.
  return Math.abs(best.delta) <= tolerance ? best : null;
}

function refineTouch(left, seed, right, at) {
  const tolerance = 1e-10 * Math.max(Math.abs(left.delta), Math.abs(right.delta));
  let low = left.x, high = right.x, best = seed;
  let a = at(high - golden * (high - low));
  let b = at(low + golden * (high - low));
  for (let i = 0; i < 44; i++) {
    if (!a || !b) return null;
    for (const point of [a, b]) {
      if (!point.sign) return point;
      if (Math.abs(point.delta) < Math.abs(best.delta)) best = point;
    }
    if (a.x <= low || b.x >= high || a.x >= b.x) break;
    if (Math.abs(a.delta) <= Math.abs(b.delta)) {
      high = b.x;
      b = a;
      a = at(high - golden * (high - low));
    } else {
      low = a.x;
      a = b;
      b = at(low + golden * (high - low));
    }
  }
  return !best.sign || Math.abs(best.delta) <= tolerance ? best : null;
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
          if (a?.sign && b?.sign && a.sign !== b.sign && candidates.length < maxCurveMarkers) {
            marker(refineCrossing(a, b, at));
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
          marker(refineTouch(a, current, b, at));
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
    const edges = new Set();
    const isolated = new Map();
    const verticesOnSegments = new Set();
    let hasCoincidence = false, hasDistinct = false;
    function vertex(row, col) {
      const z = first.samples[row][col].z, otherZ = second.samples[row][col].z;
      return { id: row + ',' + col, x: gridCoordinate(xmin, xmax, col, cols - 1),
        y: gridCoordinate(ymin, ymax, row, rows - 1), z, otherZ, sign: sign(z, otherZ) };
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
      if (!secondCells.has(row + ',' + col)) continue;
      const a = vertex(row, col), b = vertex(row, col + 1);
      const c = vertex(row + 1, col + 1), d = vertex(row + 1, col);
      contour([a, b, c]);
      contour([a, c, d]);
    }
    if (hasCoincidence && !hasDistinct) overlaps.push(pair);
    for (const [id, point] of isolated) {
      if (!verticesOnSegments.has(id)) points.push({ pair, point });
    }
  }
  return { segments, overlaps, points };
}
