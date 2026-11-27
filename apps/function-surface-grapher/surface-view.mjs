import { axisFraction, axisTicks, formatValue, seriesColors } from './coordinates.mjs?v=1.1.1';
import { gridCoordinate } from './sampling.mjs?v=1.1.1';

const axisColors = ['#a8eee6', '#edc8ff', '#ffd5a1'];
const interpolate = (min, max, fraction) => min * (1 - fraction) + max * fraction;
const blend = (values, weights) => values.reduce((sum, value, i) => sum + value * weights[i], 0);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function tone(color, height) {
  const gain = .51 + .49 * height;
  const channels = color.slice(1).match(/../g).map(channel => Math.round(Number.parseInt(channel, 16) * gain));
  return 'rgb(' + channels.join(' ') + ')';
}

function surfaceProjection(ranges, width, height, yaw, pitch, scaleMode) {
  // Half spans remain finite even when the actual z range exceeds Number.MAX_VALUE.
  const spans = ranges.map(([low, high]) => high / 2 - low / 2);
  const longest = Math.max(...spans);
  const radii = scaleMode === 'equal' ? spans.map(span => span / longest) : [1, 1, .775];
  const [rx, ry, rz] = radii;
  const floor = -rz - .12;
  const top = rz + .12;
  const horizontalReach = Math.hypot(rx, ry);
  const verticalReach = Math.hypot(horizontalReach, top);
  const small = width < 420;
  const scale = Math.max(1, Math.min((width / 2 - (small ? 38 : 64)) / horizontalReach,
    (height / 2 - (small ? 28 : 35)) / verticalReach));
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);

  function project(x, y, z) {
    const across = x * cy - y * sy;
    const depth = x * sy + y * cy;
    return [width / 2 + across * scale, height / 2 + (depth * sp - z * cp) * scale, depth * cp + z * sp];
  }

  function mapAxis(axis, value) {
    const [low, high] = ranges[axis];
    return low === high ? 0 : (2 * axisFraction(value, low, high) - 1) * radii[axis];
  }

  return { project, mapAxis, rx, ry, rz, top, floor, cy, sy };
}

function trace(ctx, points, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
}

function axisLayout(projection, ranges, width) {
  const { project, mapAxis, rx, ry, floor, top, cy, sy } = projection;
  const xFront = sy >= 0 ? rx : -rx;
  const yFront = cy >= 0 ? ry : -ry;
  const xLeft = cy >= 0 ? -rx : rx;
  const yLeft = sy >= 0 ? ry : -ry;
  const floorCenter = project(0, 0, floor);
  return [
    { line: [project(-rx, yFront, floor), project(rx, yFront, floor)], at: value => project(mapAxis(0, value), yFront, floor) },
    { line: [project(xFront, -ry, floor), project(xFront, ry, floor)], at: value => project(xFront, mapAxis(1, value), floor) },
    { line: [project(xLeft, yLeft, floor), project(xLeft, yLeft, top)], at: value => project(xLeft, yLeft, mapAxis(2, value)) },
  ].map(({line, at}, axis) => {
    const [start, end] = line;
    const length = distance(start, end);
    let outward = [0, 1];
    let along = [1, 0];
    if (axis === 2) {
      outward = [-1, 0];
      along = [0, -1];
    } else if (length > .01) {
      along = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];
      outward = [-along[1], along[0]];
      const relative = [(start[0] + end[0]) / 2 - floorCenter[0], (start[1] + end[1]) / 2 - floorCenter[1]];
      if (relative[0] * outward[0] + relative[1] * outward[1] < 0) outward = outward.map(value => -value);
    }

    const [min, max] = ranges[axis];
    const divisions = clamp(Math.floor(length / (width < 420 ? 43 : 61)), 2, 6);
    const generated = min === max ? [] : axisTicks(min, max, divisions);
    const values = [min, ...generated.map(tick => tick.value).filter(value => value > min && value < max)];
    if (min !== max) values.push(max);
    let texts;
    for (let precision = 6; precision <= 17; precision++) {
      texts = values.map(value => formatValue(value, precision));
      if (new Set(texts).size === values.length) break;
    }

    return {color: axisColors[axis], name: ['x', 'y', 'z'][axis], line, outward, along,
      ticks: values.map((value, i) => ({text: texts[i], point: at(value), endpoint: value === min || value === max}))};
  });
}

function drawCage(ctx, {project, rx, ry, rz, floor}, axes) {
  const corners = [[-rx, -ry], [rx, -ry], [rx, ry], [-rx, ry]];
  const meshFloor = corners.map(([x, y]) => project(x, y, floor));
  trace(ctx, [...meshFloor, meshFloor[0]], '#473751');
  for (const fraction of [.25, .5, .75]) {
    const x = interpolate(-rx, rx, fraction), y = interpolate(-ry, ry, fraction);
    trace(ctx, [project(x, -ry, floor), project(x, ry, floor)], '#392d46');
    trace(ctx, [project(-rx, y, floor), project(rx, y, floor)], '#392d46');
  }
  const meshRoof = corners.map(([x, y]) => project(x, y, rz));
  if (rz > 0) {
    trace(ctx, [...meshRoof, meshRoof[0]], '#3c3048');
    meshRoof.forEach((point, index) => trace(ctx, [meshFloor[index], point], '#3c3048'));
  }
  for (const {line, color} of axes) trace(ctx, line, color, 1.25);
}

function drawAxisLabels(ctx, axes, width, height) {
  const labels = [];
  const fontSize = width < 420 ? 12 : 13;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  function place(text, point, axis, bold = false) {
    ctx.font = (bold ? '700 ' : '') + fontSize + 'px system-ui';
    const halfWidth = ctx.measureText(text).width / 2 + 2;
    if (halfWidth * 2 + 8 > width) return;
    const halfHeight = (fontSize + 2) / 2;
    const [ox, oy] = axis.outward;
    const [ax, ay] = axis.along;
    const clearance = 6 + Math.abs(ox) * halfWidth + Math.abs(oy) * halfHeight;
    for (const extra of [0, 9, -9, 18, -18]) {
      const x = clamp(point[0] + clearance * ox + ax * extra, halfWidth + 3, width - halfWidth - 3);
      const y = clamp(point[1] + clearance * oy + ay * extra, halfHeight + 3, height - halfHeight - 3);
      const box = [x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight];
      if (labels.some(([left, top, right, bottom]) => box[0] < right + 2 && box[2] > left - 2 &&
          box[1] < bottom + 2 && box[3] > top - 2)) continue;
      labels.push(box);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#161121';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = axis.color;
      ctx.fillText(text, x, y);
      return;
    }
  }

  for (const axis of axes) {
    for (const {point} of axis.ticks) {
      const [x, y] = point;
      trace(ctx, [point, [x + 5 * axis.outward[0], y + 5 * axis.outward[1]]], axis.color, 1.25);
    }
    const tip = axis.line[1];
    place(axis.name, [tip[0] + axis.along[0] * 12, tip[1] + axis.along[1] * 12], axis, true);
  }
  // Prefer the ends of the range when nearby ticks compete for space.
  for (const endpoint of [true, false]) {
    for (const axis of axes) {
      for (const tick of axis.ticks.filter(tick => tick.endpoint === endpoint)) place(tick.text, tick.point, axis);
    }
  }
}

function barycentric(vertices, x, y) {
  const [[ax, ay], [bx, by], [cx, cy]] = vertices;
  const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(det) < 1e-10) return null;
  const a = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det;
  const b = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det;
  const c = 1 - a - b;
  if (Math.min(a, b, c) < -1e-8) return null;
  return [a, b, c];
}

export function paintSurface(ctx, {series, limits, domain}, {width, height, yaw, pitch, scaleMode}) {
  const ranges = [[domain.xmin, domain.xmax], [domain.ymin, domain.ymax], limits];
  const projection = surfaceProjection(ranges, width, height, yaw, pitch, scaleMode);
  const {project, mapAxis} = projection;
  const projectPoint = ({x, y, z}) => project(mapAxis(0, x), mapAxis(1, y), mapAxis(2, z));
  const meshes = new Map();
  const triangles = series.flatMap(({index, samples, cells, evaluate}) => {
    const rows = samples.length, columns = samples[0].length;
    const grid = samples.map((row, r) => row.map(({z}, c) => {
      const x = gridCoordinate(...ranges[0], c, columns - 1);
      const y = gridCoordinate(...ranges[1], r, rows - 1);
      return {x, y, z, unit: [axisFraction(x, ...ranges[0]), axisFraction(y, ...ranges[1])],
        screen: z === null ? null : projectPoint({x, y, z})};
    }));
    const byCell = new Map();
    const color = seriesColors[index % seriesColors.length];
    meshes.set(index, {rows, columns, byCell, evaluate});
    return cells.flatMap(([row, col]) => {
      const a = grid[row][col], b = grid[row][col + 1], c = grid[row + 1][col + 1], d = grid[row + 1][col];
      const zFraction = limits[0] === limits[1] ? .5 : (axisFraction(a.z, ...limits) + axisFraction(c.z, ...limits)) / 2;
      const fill = tone(color, zFraction);
      const local = [[a, b, c], [c, d, a]].map(world => {
        const screen = world.map(vertex => vertex.screen);
        return {world, screen, depth: screen.reduce((sum, point) => sum + point[2], 0), fill, seriesIndex: index};
      });
      byCell.set(row * columns + col, local);
      return local;
    });
  });
  triangles.sort((a, b) => a.depth - b.depth);

  function pick(px, py) {
    for (let i = triangles.length - 1; i >= 0; i--) {
      const {world, screen, seriesIndex} = triangles[i];
      const weights = barycentric(screen, px, py);
      if (!weights) continue;
      const x = clamp(blend(world.map(vertex => vertex.x), weights), ...ranges[0]);
      const y = clamp(blend(world.map(vertex => vertex.y), weights), ...ranges[1]);
      const z = meshes.get(seriesIndex).evaluate(x, y);
      return Number.isFinite(z) ? {x, y, z, px, py, seriesIndex} : null;
    }
    return null;
  }

  function probeAt(x, y, seriesIndex = series[0].index) {
    const mesh = meshes.get(seriesIndex);
    if (!mesh || !Number.isFinite(x) || !Number.isFinite(y) ||
        x < domain.xmin || x > domain.xmax || y < domain.ymin || y > domain.ymax) return null;
    const {rows, columns, byCell, evaluate} = mesh;
    const unitX = axisFraction(x, ...ranges[0]), unitY = axisFraction(y, ...ranges[1]);
    const col = Math.min(columns - 2, Math.floor(unitX * (columns - 1)));
    const row = Math.min(rows - 2, Math.floor(unitY * (rows - 1)));
    // At a cell boundary either neighbor can supply the displayed surface.
    for (const r of [row, row - 1, row + 1]) {
      for (const c of [col, col - 1, col + 1]) {
        if (r < 0 || r >= rows - 1 || c < 0 || c >= columns - 1) continue;
        for (const {world, screen} of byCell.get(r * columns + c) ?? []) {
          const weights = barycentric(world.map(vertex => vertex.unit), unitX, unitY);
          if (!weights) continue;
          const z = evaluate(x, y);
          if (!Number.isFinite(z)) return null;
          return {x, y, z, px: blend(screen.map(point => point[0]), weights),
            py: blend(screen.map(point => point[1]), weights), seriesIndex};
        }
      }
    }
    return null;
  }

  const axes = axisLayout(projection, ranges, width);
  ctx.save();
  drawCage(ctx, projection, axes);
  for (const {screen, fill} of triangles) {
    ctx.beginPath();
    screen.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    // Each triangle contributes two quad edges. Omit the internal diagonal.
    trace(ctx, screen, 'rgba(235,225,253,.37)', .85);
  }
  drawAxisLabels(ctx, axes, width, height);
  ctx.restore();
  return {pick, projectPoint, probeAt};
}
