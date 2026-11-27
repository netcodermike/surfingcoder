import { axisFraction, axisTicks, axisValue, formatValue, seriesColors } from './coordinates.mjs?v=1.1.3';
import { gridCoordinate, needsFinerSurface, sampleCurve, surfaceCells } from './sampling.mjs?v=1.1.3';
import { findCurveIntersections, findSurfaceIntersections } from './intersections.mjs?v=1.1.3';
import { paintSurface, surfaceColors } from './surface-view.mjs?v=1.1.3';

const functions = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, abs: Math.abs,
  exp: Math.exp, log: Math.log, ln: Math.log, log10: Math.log10, cbrt: Math.cbrt,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
};
const operators = {
  '+': (a, b) => a + b, '-': (a, b) => a - b,
  '*': (a, b) => a * b, '/': (a, b) => a / b, '^': (a, b) => a ** b,
};
const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };

function expressionBody(source, dependent) {
  const text = source.trim().replaceAll('−', '-').toLowerCase();
  const prefix = /^([a-z])\s*=\s*/.exec(text);
  if (!prefix) return text;
  if (prefix[1] !== dependent) throw Error('This graph expects ' + dependent + ' on the left of =.');
  return text.slice(prefix[0].length);
}

export function compileExpression(source, variables = ['x']) {
  const text = expressionBody(source, variables.includes('y') ? 'z' : 'y');
  if (!text || text.length > 256) throw Error('Enter an expression of 1 to 256 characters.');
  const tokens = [];
  const token = /\s+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z][a-z0-9]*|[()+*/^\-]/y;
  let position = 0;
  while (position < text.length) {
    token.lastIndex = position;
    const match = token.exec(text);
    if (!match) throw Error('Unexpected character ' + text[position]);
    position = token.lastIndex;
    if (match[0].trim()) tokens.push(match[0]);
  }
  let index = 0;
  function atom() {
    const token = tokens[index++];
    if (token === '+' || token === '-') {
      const operand = expression(3);
      return token === '-' ? (x, y) => -operand(x, y) : operand;
    }
    if (token === '(') {
      const body = expression(1);
      if (tokens[index++] !== ')') throw Error('Add the closing parenthesis.');
      return body;
    }
    if (!token) throw Error('Expected a number, variable, or function.');
    const number = Number(token);
    if (Number.isFinite(number)) return () => number;
    if (variables.includes(token)) return token === 'x' ? x => x : (_, y) => y;
    if (token === 'pi') return () => Math.PI;
    if (token === 'e') return () => Math.E;
    if (!Object.hasOwn(functions, token)) throw Error('Unknown name or number ' + token);
    if (tokens[index++] !== '(') throw Error('Put parentheses after ' + token + '.');
    const body = expression(1);
    if (tokens[index++] !== ')') throw Error('Add the closing parenthesis.');
    return (x, y) => functions[token](body(x, y));
  }
  function expression(level) {
    let left = atom();
    while (Object.hasOwn(precedence, tokens[index]) && precedence[tokens[index]] >= level) {
      const operator = tokens[index++];
      const before = left;
      const right = expression(precedence[operator] + (operator === '^' ? 0 : 1));
      left = (x, y) => operators[operator](before(x, y), right(x, y));
    }
    return left;
  }
  const evaluate = expression(1);
  if (index !== tokens.length) throw Error('Use * for multiplication and check parentheses.');
  return (x, y = 0) => evaluate(x, y);
}

export function validateDomain(xmin, xmax, ymin, ymax) {
  const minimumSpan = .00001;
  const hasSpan = (min, max) => {
    const roundoff = Number.EPSILON * Math.max(Math.abs(min), Math.abs(max), minimumSpan);
    return max - min >= minimumSpan - roundoff;
  };
  if (![xmin, xmax, ymin, ymax].every(x => Number.isFinite(x) && Math.abs(x) <= 1e6) ||
      !hasSpan(xmin, xmax) || !hasSpan(ymin, ymax)) {
    throw Error('Each axis needs bounds between −1,000,000 and 1,000,000, at least 0.00001 apart.');
  }
  return { xmin, xmax, ymin, ymax };
}

export function surfaceSamples(evaluate, domain, steps = 30) {
  const { xmin, xmax, ymin, ymax } = domain;
  return Array.from({length: steps+1}, (_, i) => Array.from({length: steps+1}, (_, j) => {
    const z = evaluate(gridCoordinate(xmin, xmax, j, steps), gridCoordinate(ymin, ymax, i, steps));
    return {x: 2*j/steps-1, y: 2*i/steps-1, z: Number.isFinite(z) ? z : null};
  }));
}

const examples = {
  ripple: ['3d', ['2*sin(sqrt(x^2+y^2))'], -8, 8, -8, 8],
  saddle: ['3d', ['x^2-y^2'], -3, 3, -3, 3],
  hills: ['3d', ['cos(x)*sin(y)'], -6, 6, -6, 6],
  'compare-surfaces': ['3d', ['0.5*x', '-0.5*x+1'], -3, 3, -3, 3],
  sine: ['2d', ['sin(x)+0.4*cos(3*x)'], -9, 9, -2, 2],
  cubic: ['2d', ['x^3-3*x'], -4, 4, -8, 8],
  reciprocal: ['2d', ['1/x'], -6, 6, -4, 4],
  'compare-curves': ['2d', ['sin(x)', 'cos(x)'], -7, 7, -2, 2],
};

export function buildModel({ mode, sources }, domain) {
  const parsed = sources.map((source, index) => {
    try {
      const evaluate = compileExpression(source, mode === '2d' ? ['x'] : ['x', 'y']);
      const dependent = mode === '2d' ? 'y' : 'z';
      return { index, source, evaluate, formula: dependent + ' = ' + expressionBody(source, dependent) };
    } catch (error) {
      throw Error('Expression ' + (index + 1) + ' · ' + error.message);
    }
  });
  const model = { mode, sources, domain };
  if (mode === '2d') {
    const series = parsed.map(entry => ({ ...entry, ...sampleCurve(entry.evaluate, domain) }));
    const available = series.filter(entry => entry.hasFiniteSamples);
    if (!available.length) throw Error('No expressions have finite values in this x-range.');
    return { ...model, series, intersections: findCurveIntersections(available, domain) };
  }

  let series = parsed.map(entry => ({ ...entry, samples: surfaceSamples(entry.evaluate, domain) }));
  if (series.some(entry => needsFinerSurface(entry.evaluate, domain, entry.samples))) {
    // Use a common, non-overlapping lattice so intersections can compare the same vertices.
    series = parsed.map(entry => ({ ...entry, samples: surfaceSamples(entry.evaluate, domain, 61) }));
  }
  let low = Infinity, high = -Infinity;
  series = series.map(entry => {
    const cells = surfaceCells(entry.evaluate, domain, entry.samples);
    for (const [row, col] of cells) {
      for (const z of [entry.samples[row][col].z, entry.samples[row][col + 1].z,
        entry.samples[row + 1][col].z, entry.samples[row + 1][col + 1].z]) {
        low = Math.min(low, z);
        high = Math.max(high, z);
      }
    }
    return { ...entry, cells };
  });
  const available = series.filter(entry => entry.cells.length);
  if (!available.length) throw Error('No drawable surface cells. Try smaller bounds with finite values.');
  const intersections = findSurfaceIntersections(available, domain);
  for (const { point: [, , z] } of intersections.points) {
    low = Math.min(low, z);
    high = Math.max(high, z);
  }
  return { ...model, series, limits: [low, high], intersections };
}

export function curveViewport(domain, box, equalUnits = false) {
  const { xmin, xmax, ymin, ymax } = domain;
  let { left, top, right, bottom } = box;
  if (equalUnits) {
    const pixelsPerUnit = Math.min((right - left) / (xmax - xmin), (bottom - top) / (ymax - ymin));
    const padX = ((right - left) - (xmax - xmin) * pixelsPerUnit) / 2;
    const padY = ((bottom - top) - (ymax - ymin) * pixelsPerUnit) / 2;
    left += padX;
    right -= padX;
    top += padY;
    bottom -= padY;
  }
  return {
    left, top, right, bottom, width: right - left, height: bottom - top,
    x: value => left + axisFraction(value, xmin, xmax) * (right - left),
    y: value => bottom - axisFraction(value, ymin, ymax) * (bottom - top),
    inputX: pixel => axisValue((pixel - left) / (right - left), xmin, xmax),
    contains: (x, y) => x >= left && x <= right && y >= top && y <= bottom,
  };
}

function initialize() {
  const $ = id => document.getElementById(id);
  const chart = $('plot'), ctx = chart.getContext('2d');
  const marker = $('plot-overlay'), overlay = marker.getContext('2d');
  const axes = ['xmin', 'xmax', 'ymin', 'ymax'];
  const inputFields = () => [...$('series-inputs').querySelectorAll('input')];
  const sources = () => inputFields().map(input => input.value.trim());
  const fmt = n => formatValue(n);
  const range = (min, max) => fmt(min) + ' to ' + fmt(max);
  let W = 0, H = 0, pixelRatio = 0;
  let model, home, view, yaw = -.65, pitch = .57, drag, hover, pin;
  const initialSolutionCount = 16;
  let showAllSolutions = false;
  let projectedSolutions = [];

  function line(context, points, color, width = 1) {
    context.strokeStyle = color;
    context.lineWidth = width;
    context.beginPath();
    points.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
    context.stroke();
  }

  function label(text, x, y, align = 'left') {
    ctx.fillStyle = '#dfd4ed';
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }

  function paint2d() {
    const { xmin, xmax, ymin, ymax } = model.domain;
    const top = 28, bottom = H - 43, right = W - 20;
    ctx.font = (W < 440 ? 12 : 13) + 'px system-ui';
    const ys = axisTicks(ymin, ymax, Math.max(2, Math.floor((bottom - top) / 41)));
    const left = Math.min(W * .39, Math.max(39, ...ys.map(tick => ctx.measureText(tick.text).width + 13)));
    const bounds = curveViewport(model.domain, { left, top, right, bottom }, $('axis-scale').value === 'equal');
    const xs = axisTicks(xmin, xmax, Math.max(2, Math.floor(bounds.width / 85)));
    ctx.strokeStyle = '#675673';
    ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
    let lastRight = -Infinity;
    for (const { value, text } of xs) {
      const x = bounds.x(value);
      const halfWidth = ctx.measureText(text).width / 2;
      const center = Math.max(halfWidth + 4, Math.min(W - halfWidth - 4, x));
      line(ctx, [[x, bounds.top], [x, bounds.bottom]], value === 0 ? '#ac93c5' : '#44384f');
      if (center - halfWidth >= lastRight + 7) {
        label(text, center, bounds.bottom + 19, 'center');
        lastRight = center + halfWidth;
      }
    }
    let lastY = Infinity;
    for (const { value, text } of ys) {
      const y = bounds.y(value);
      line(ctx, [[bounds.left, y], [bounds.right, y]], value === 0 ? '#ac93c5' : '#44384f');
      if (lastY - y >= 15) {
        label(text, bounds.left - 8, y + 4, 'right');
        lastY = y;
      }
    }
    label('x', bounds.right, Math.min(H - 8, bounds.bottom + 34), 'right');
    label('y', bounds.left, Math.max(13, bounds.top - 8));

    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.clip();
    for (const { paths, index } of model.series) {
      ctx.strokeStyle = seriesColors[index];
      ctx.lineWidth = 2.3;
      ctx.beginPath();
      for (const [[x, y], ...rest] of paths) {
        ctx.moveTo(bounds.x(x), bounds.y(y));
        for (const [nextX, nextY] of rest) ctx.lineTo(bounds.x(nextX), bounds.y(nextY));
      }
      ctx.stroke();
    }
    ctx.restore();
    return bounds;
  }

  function solutionAtPoint(point, pair) {
    const [x, y, z] = point;
    return { x, y, ...(z === undefined ? {} : { z }), pair, seriesIndex: pair[0] };
  }

  function drawSolutionPoint(world, pair) {
    const [x, y] = world;
    const screen = world.length === 2 ? [view.x(x), view.y(y)] : view.projectPoint(solutionAtPoint(world, pair));
    ctx.beginPath();
    ctx.arc(screen[0], screen[1], 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#211625';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffe690';
    ctx.fill();
    ctx.stroke();
    projectedSolutions.push({ screen: [screen], world: [world], pair });
  }

  function drawSolutions() {
    projectedSolutions = [];
    if (!$('show-intersections').checked) return;
    if (model.mode === '2d') {
      for (const { points, pair } of model.intersections.overlapPaths ?? []) {
        const screen = points.map(({ x, y }) => [view.x(x), view.y(y)]);
        line(ctx, screen, '#ffe690', 2.6);
        for (let i = 1; i < points.length; i++) {
          const world = points.slice(i - 1, i + 1).map(({x, y}) => [x, y]);
          projectedSolutions.push({ screen: screen.slice(i - 1, i + 1), world, pair });
        }
      }
      for (const { x, y, pair } of model.intersections.points) {
        drawSolutionPoint([x, y], pair);
      }
      return;
    }
    for (const { points, pair } of model.intersections.segments) {
      const screen = points.map(([x, y, z]) => view.projectPoint({ x, y, z }));
      projectedSolutions.push({ screen, world: points, pair });
    }
    for (const color of ['#2a2031', '#ffe690']) {
      ctx.strokeStyle = color;
      ctx.lineWidth = color === '#ffe690' ? 2.5 : 4.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const { screen: [[x0, y0], [x1, y1]] } of projectedSolutions) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    for (const { point, pair } of model.intersections.points ?? []) drawSolutionPoint(point, pair);
  }

  function paint() {
    if (!W || !H) return;
    ctx.fillStyle = '#161121';
    ctx.fillRect(0, 0, W, H);
    if (!model) return;
    view = model.mode === '2d' ? paint2d() :
      paintSurface(ctx, model, { width: W, height: H, yaw, pitch, scaleMode: $('axis-scale').value });
    drawSolutions();
    paintProbe();
  }

  function resizePlot() {
    const width = chart.clientWidth, height = chart.clientHeight;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (width <= 0 || height <= 0 || (W === width && H === height && pixelRatio === ratio)) return;
    W = width;
    H = height;
    pixelRatio = ratio;
    for (const [canvas, context] of [[chart, ctx], [marker, overlay]]) {
      canvas.width = Math.round(W * ratio);
      canvas.height = Math.round(H * ratio);
      context.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    }
    hover = undefined;
    paint();
  }

  const pairLabel = pair => pair.map(index => 'f' + '₁₂₃₄'[index]).join(' = ');
  function coordinates(point) {
    const { xmin, xmax, ymin, ymax } = model.domain;
    function coordinate(axis, value, low, high) {
      const span = high - low;
      const offsetDigits = Math.log10(Math.abs(value)) - Math.log10(span);
      const precision = Number.isFinite(offsetDigits) ? Math.min(17, Math.max(8, Math.ceil(offsetDigits + 7))) : 8;
      return axis + ' = ' + formatValue(value, precision);
    }
    return [coordinate('x', point.x, xmin, xmax), coordinate('y', point.y, ymin, ymax),
      ...(point.z === undefined ? [] : [coordinate('z', point.z, ...model.limits)])].join(' · ');
  }

  function projectProbe(point) {
    if (model.mode === '2d') return { ...point, px: view.x(point.x), py: view.y(point.y) };
    if (point.pair) {
      const [px, py] = view.projectPoint(point);
      return { ...point, px, py };
    }
    return view.probeAt(point.x, point.y, point.seriesIndex) ?? { ...point, px: NaN, py: NaN };
  }

  function paintProbe() {
    if (!view) return;
    overlay.clearRect(0, 0, W, H);
    const point = pin ? projectProbe(pin) : hover;
    const readout = $('probe-values');
    $('clear-pin').hidden = !pin;
    for (const key of ['x', 'y', 'z', 'series']) delete readout.dataset[key];
    if (!point) {
      $('probe-title').textContent = 'Coordinates';
      readout.textContent = 'Hover or tap the graph to inspect a point.';
      return;
    }
    for (const key of ['x', 'y', 'z']) if (Number.isFinite(point[key])) readout.dataset[key] = point[key];
    readout.dataset.series = point.seriesIndex;
    const domain = model.domain;
    const is2d = model.mode === '2d';
    const inDomain = point.x >= domain.xmin && point.x <= domain.xmax &&
      point.y >= domain.ymin && point.y <= domain.ymax;
    $('probe-title').textContent = (point.pair ? pairLabel(point.pair) + (is2d ? ' intersection' : ' sampled intersection') :
      (is2d ? 'Curve ' : 'Surface ') + (point.seriesIndex + 1)) + (pin ? ' · pinned' : '');
    readout.textContent = coordinates(point) +
      (Number.isFinite(point.y) && !inDomain ? ' · outside this view' : '');
    if (is2d && point.px >= view.left && point.px <= view.right) {
      overlay.setLineDash([3, 4]);
      line(overlay, [[point.px, view.top], [point.px, view.bottom]], '#d9d0e5');
      overlay.setLineDash([]);
    }
    if (!inDomain || ![point.px, point.py].every(Number.isFinite)) return;
    overlay.beginPath();
    overlay.arc(point.px, point.py, 6, 0, Math.PI * 2);
    const colors = is2d ? seriesColors : surfaceColors;
    overlay.fillStyle = point.pair ? '#ffe690' : colors[point.seriesIndex];
    overlay.strokeStyle = '#f8f1fd';
    overlay.lineWidth = 2;
    overlay.fill();
    overlay.stroke();
  }

  function setPin(point) {
    pin = point || undefined;
    hover = undefined;
    paintProbe();
    $('probe-announcement').textContent = pin ? $('probe-title').textContent + '. ' + coordinates(pin) : 'Pin cleared.';
  }

  function syncSolutions() {
    const { intersections, sources: plotted } = model;
    const is2d = model.mode === '2d';
    $('solution-panel').hidden = plotted.length < 2;
    const list = $('solution-points'), toggle = $('toggle-solutions');
    list.replaceChildren();
    if (plotted.length < 2) {
      toggle.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      return;
    }
    const overlaps = intersections.overlaps?.length ?? 0;
    const entries = is2d ? intersections.points.map(({ x, y, pair }) => solutionAtPoint([x, y], pair)) :
      intersections.points.map(({ point, pair }) => solutionAtPoint(point, pair));
    if (!is2d) {
      const traces = new Map(intersections.segments.map(({ points, pair }) => [pair.join(','), solutionAtPoint(points[0], pair)]));
      entries.push(...traces.values());
    }
    const count = entries.length;
    const canExpand = count > initialSolutionCount;
    const expanded = canExpand && showAllSolutions;
    toggle.hidden = !canExpand;
    toggle.setAttribute('aria-expanded', String(expanded));
    if (canExpand) toggle.textContent = expanded ? 'Show first ' + initialSolutionCount : 'Show all ' + count;
    const overlapText = overlaps ? ' ' + overlaps + ' expression ' + (overlaps === 1 ? 'pair overlaps' : 'pairs overlap') + ' in sampled regions.' : '';
    const pointCount = intersections.points.length;
    const summary = pointCount ? pointCount + (pointCount === 1 ? ' intersection point' : ' intersection points') + ' found in this view.'
      : is2d ? 'No isolated intersections found in this view.' : '';
    const traceText = !is2d && intersections.segments.length ? 'Traces show where the sampled surfaces meet. Inspect one on the graph or below.' : '';
    $('intersection-summary').textContent = ([summary, traceText].filter(Boolean).join(' ') || (overlaps ? '' : 'No intersections found on the sampled surfaces.')) +
      overlapText + (canExpand && !expanded ? ' Showing the first ' + initialSolutionCount + '.' : '') +
      (intersections.limited ? ' Narrow the bounds to search a smaller region.' : '');
    for (const point of expanded ? entries : entries.slice(0, initialSolutionCount)) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = pairLabel(point.pair) + ' · ' + coordinates(point);
      button.addEventListener('click', () => setPin(point));
      item.append(button);
      list.append(item);
    }
  }

  function showPlot(next, resetProbe = false) {
    model = next;
    hover = undefined;
    if (resetProbe) {
      pin = undefined;
      showAllSolutions = false;
    }
    const { mode, series, domain, limits } = next;
    const surface = mode === '3d';
    const colors = surface ? surfaceColors : seriesColors;
    $('error').textContent = '';
    $('reading').textContent = series.map(entry => entry.formula).join(' · ');
    $('plot-legend').replaceChildren(...series.map(entry => {
      const item = document.createElement('li');
      const status = surface ? (entry.cells.length ? '' : ' · no drawable cells') :
        (entry.paths.length ? '' : entry.hasFiniteSamples ? ' · outside the view' : ' · no finite values');
      item.dataset.series = entry.index;
      item.style.setProperty('--series-color', colors[entry.index]);
      item.textContent = (entry.index + 1) + ' · ' + entry.formula + status;
      return item;
    }));
    $('plot-details').textContent = 'x ' + range(domain.xmin, domain.xmax) + ' · y ' + range(domain.ymin, domain.ymax) +
      (surface ? ' · Sampled z ' + range(...limits) : '');
    $('plot-help').textContent = 'Drag or use arrow keys to ' + (surface ? 'rotate.' : 'pan.') +
      ' Tap to pin, Shift + arrows to inspect with the keyboard, and Esc to clear.';
    $('rotate-controls').hidden = !surface;
    chart.setAttribute('aria-label', (surface ? '3D surface plot' : '2D curve plot') +
      ' for ' + series.map(entry => entry.formula).join(' and '));
    syncSolutions();
    paint();
  }

  function addInput(value = '', focus = false) {
    const index = inputFields().length;
    if (index >= seriesColors.length) return;
    const group = document.createElement('div');
    group.className = 'series-row';
    const label = document.createElement('label');
    label.className = 'series-field';
    const title = document.createElement('span');
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 256;
    input.required = true;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.className = 'serial-expression';
    input.value = value;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.removeSeries = '';
    remove.textContent = 'Remove';
    label.append(title, input);
    group.append(label, remove);
    $('series-inputs').append(group);
    syncInputs();
    if (focus) input.focus();
  }

  function syncInputs() {
    const inputs = inputFields();
    const colors = $('mode').value === '3d' ? surfaceColors : seriesColors;
    inputs.forEach((input, index) => {
      const label = input.parentElement;
      label.dataset.series = index;
      label.style.setProperty('--series-color', colors[index]);
      label.querySelector('span').textContent = 'Expression ' + (index + 1);
      label.parentElement.querySelector('button[data-remove-series]')?.setAttribute('aria-label',
        'Remove expression ' + (index + 1));
    });
    $('add-series').disabled = inputs.length >= seriesColors.length;
  }

  function reportError(problem) {
    $('error').textContent = problem.message + (model ? ' The previous plot is still shown.' : '');
  }

  function refresh() {
    try {
      const domain = validateDomain(...axes.map(id => $(id).valueAsNumber));
      const next = buildModel({ mode: $('mode').value, sources: sources() }, domain);
      if (model?.mode !== next.mode) {
        yaw = -.65;
        pitch = .57;
      }
      home = domain;
      showPlot(next, true);
    } catch (problem) {
      reportError(problem);
    }
  }

  function writeBounds(values) {
    axes.forEach((id, i) => { $(id).value = String(values[i]); });
  }

  function changeBounds(values) {
    try {
      const next = buildModel(model, validateDomain(...values));
      writeBounds(values);
      showPlot(next);
    } catch (problem) {
      reportError(problem);
    }
  }

  function canChangeBounds() {
    if (!model) return false;
    const edits = sources();
    if ($('mode').value !== model.mode || model.sources.length !== edits.length ||
        model.sources.some((value, index) => value !== edits[index]) ||
        axes.some(id => $(id).valueAsNumber !== model.domain[id])) {
      $('error').textContent = 'Plot your edits before panning or zooming.';
      return false;
    }
    return true;
  }

  function setExample(name) {
    const example = examples[name];
    if (!example) return;
    const [mode, expressions, ...bounds] = example;
    $('mode').value = mode;
    $('formula').value = expressions[0];
    for (const row of $('series-inputs').querySelectorAll('.series-row')) row.remove();
    for (const expression of expressions.slice(1)) addInput(expression);
    syncInputs();
    writeBounds(bounds);
    yaw = -.65;
    pitch = .57;
    refresh();
  }

  function zoom(factor) {
    if (!canChangeBounds()) return;
    const { xmin, xmax, ymin, ymax } = model.domain;
    const adjust = (min, max) => {
      const padding = (max - min) * (factor - 1) / 2;
      return [min - padding, max + padding];
    };
    changeBounds([...adjust(xmin, xmax), ...adjust(ymin, ymax)]);
  }

  function pan({ xmin, xmax, ymin, ymax }, xFraction, yFraction) {
    const dx = (xmax - xmin) * xFraction;
    const dy = (ymax - ymin) * yFraction;
    changeBounds([xmin + dx, xmax + dx, ymin + dy, ymax + dy]);
  }

  function rotate(newYaw, newPitch) {
    yaw = newYaw;
    pitch = Math.max(.13, Math.min(1.45, newPitch));
    hover = undefined;
    paint();
  }

  function pixelAt(event) {
    const box = chart.getBoundingClientRect();
    return [event.clientX - box.left - chart.clientLeft, event.clientY - box.top - chart.clientTop];
  }

  function nearestSolution(px, py) {
    let closest = null, distance = 9;
    for (const { screen, world, pair } of projectedSolutions) {
      const [[x0, y0], [x1, y1] = [x0, y0]] = screen;
      const dx = x1 - x0, dy = y1 - y0;
      const length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / length)) : 0;
      const x = x0 + dx * t, y = y0 + dy * t;
      const gap = Math.hypot(px - x, py - y);
      if (gap >= distance) continue;
      distance = gap;
      const [a, b = a] = world;
      closest = { ...solutionAtPoint(a.map((value, index) => axisValue(t, value, b[index])), pair), px: x, py: y };
    }
    return closest;
  }

  function pointAt(px, py) {
    if (!view) return null;
    const solution = nearestSolution(px, py);
    if (solution) return solution;
    if (model.mode === '3d') return view.pick(px, py);
    if (!view.contains(px, py)) return null;
    const x = view.inputX(px);
    let best, distance = Infinity;
    for (const { index, evaluate } of model.series) {
      const y = evaluate(x);
      const clientY = Number.isFinite(y) ? view.y(y) : NaN;
      const gap = Number.isFinite(clientY) ? Math.abs(clientY - py) : Infinity;
      if (!best || gap < distance) {
        distance = gap;
        best = { x, y, px: view.x(x), py: clientY, seriesIndex: index };
      }
    }
    return best;
  }

  function keyboardPoint(xStep, yStep) {
    const { xmin, xmax, ymin, ymax } = model.domain;
    const previous = pin ?? hover;
    const x = Math.max(xmin, Math.min(xmax, (previous?.x ?? axisValue(.5, xmin, xmax)) + (xmax - xmin) * xStep / 32));
    const seriesIndex = previous?.seriesIndex ?? model.series[0].index;
    if (model.mode === '2d') {
      const y = model.series.find(entry => entry.index === seriesIndex).evaluate(x);
      return { x, y, seriesIndex };
    }
    const y = Math.max(ymin, Math.min(ymax, (previous?.y ?? axisValue(.5, ymin, ymax)) + (ymax - ymin) * yStep / 32));
    return view.probeAt(x, y, seriesIndex) ?? (previous ? null : view.pick(W / 2, H / 2));
  }

  $('example').addEventListener('change', () => setExample($('example').value));
  $('mode').addEventListener('change', () => {
    $('example').value = '';
    syncInputs();
    refresh();
  });
  $('controls').addEventListener('input', event => {
    if (event.target.matches('.serial-expression') || axes.includes(event.target.id)) $('example').value = '';
  });
  $('controls').addEventListener('submit', event => { event.preventDefault(); refresh(); });
  $('add-series').addEventListener('click', () => {
    $('example').value = '';
    addInput('', true);
  });
  $('series-inputs').addEventListener('click', event => {
    const button = event.target.closest('button[data-remove-series]');
    if (!button) return;
    button.closest('.series-row').remove();
    $('example').value = '';
    syncInputs();
    $('add-series').focus();
  });
  $('axis-scale').addEventListener('change', () => { hover = undefined; paint(); });
  $('show-intersections').addEventListener('change', () => { hover = undefined; paint(); });
  $('toggle-solutions').addEventListener('click', () => {
    showAllSolutions = !showAllSolutions;
    syncSolutions();
  });
  $('clear-pin').addEventListener('click', () => { setPin(); chart.focus(); });
  $('zoom-in').addEventListener('click', () => zoom(.8));
  $('zoom-out').addEventListener('click', () => zoom(1.25));
  $('turn-left').addEventListener('click', () => rotate(yaw - .27, pitch));
  $('turn-right').addEventListener('click', () => rotate(yaw + .27, pitch));
  $('reset-view').addEventListener('click', () => {
    if (!canChangeBounds()) return;
    yaw = -.65;
    pitch = .57;
    changeBounds(axes.map(id => home[id]));
  });

  const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  chart.addEventListener('keydown', event => {
    if (!model || !view || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.key === 'Escape' || pin) setPin();
      else setPin(hover ?? keyboardPoint(0, 0));
      return;
    }
    if (!Object.hasOwn(movement, event.key)) return;
    event.preventDefault();
    const [x, y] = movement[event.key];
    if (event.shiftKey) {
      const next = keyboardPoint(x, y);
      if (next && pin) setPin(next);
      else if (next) {
        hover = projectProbe(next);
        paintProbe();
        $('probe-announcement').textContent = coordinates(next);
      }
    } else if (model.mode === '3d') rotate(yaw + x * .17, pitch + y * .12);
    else if (canChangeBounds()) pan(model.domain, x * .08, y * .08);
  });

  chart.addEventListener('pointerdown', event => {
    if (drag || event.button !== 0 || !model || !view) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch, domain: model.domain, view };
    chart.setPointerCapture(event.pointerId);
  });
  function applyDrag(active) {
    active.frame = 0;
    if (drag !== active || active.blocked) return;
    const { dx, dy } = active;
    if (model.mode === '3d') rotate(active.yaw + dx * .009, active.pitch + dy * .008);
    else pan(active.domain, -dx / active.view.width, dy / active.view.height);
  }
  chart.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) {
      if (!drag && !pin && event.pointerType !== 'touch') {
        hover = pointAt(...pixelAt(event));
        paintProbe();
      }
      return;
    }
    drag.dx = event.clientX - drag.x;
    drag.dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(drag.dx, drag.dy) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      drag.blocked = model.mode === '2d' && !canChangeBounds();
      chart.classList.add('dragging');
    }
    if (!drag.frame) {
      const active = drag;
      drag.frame = requestAnimationFrame(() => applyDrag(active));
    }
  });
  chart.addEventListener('pointerleave', () => {
    hover = undefined;
    if (!drag && !pin) paintProbe();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    chart.addEventListener(name, event => {
      if (drag?.id !== event.pointerId) return;
      if (drag.frame) {
        cancelAnimationFrame(drag.frame);
        if (name === 'pointerup') applyDrag(drag);
      }
      const tapped = name === 'pointerup' && !drag.moved;
      drag = undefined;
      chart.classList.remove('dragging');
      if (tapped) setPin(pointAt(...pixelAt(event)));
    });
  }

  new ResizeObserver(resizePlot).observe(chart);
  resizePlot();
  $('example').value = 'ripple';
  setExample('ripple');
}
if (typeof document !== 'undefined') initialize();
