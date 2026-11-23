import { sampleCurve, surfaceCells } from './sampling.mjs?v=20261122-plot-review';

const functions = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, abs: Math.abs,
  exp: Math.exp, log: Math.log, log10: Math.log10, asin: Math.asin, acos: Math.acos, atan: Math.atan,
};
const operators = {
  '+': (a, b) => a + b, '-': (a, b) => a - b,
  '*': (a, b) => a * b, '/': (a, b) => a / b, '^': (a, b) => a ** b,
};
const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };

export function compileExpression(source, variables = ['x']) {
  const text = source.trim().replaceAll('−', '-').toLowerCase();
  if (!text || text.length > 256) throw Error('Enter an expression of 1 to 256 characters.');
  const tokens = [];
  let position = 0;
  while (position < text.length) {
    const token = /\s+|(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z][a-z0-9]*|[()+*/^\-]/y;
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
      return values => token === '-' ? -operand(values) : operand(values);
    }
    if (token === '(') {
      const body = expression(1);
      if (tokens[index++] !== ')') throw Error('Add the closing parenthesis.');
      return body;
    }
    if (!token) throw Error('Expected a number, variable, or function.');
    if (Number.isFinite(Number(token))) return () => Number(token);
    if (variables.includes(token)) return values => values[token];
    if (token === 'pi') return () => Math.PI;
    if (token === 'e') return () => Math.E;
    if (!Object.hasOwn(functions, token)) throw Error('Unknown name or number ' + token);
    if (tokens[index++] !== '(') throw Error('Put parentheses after ' + token + '.');
    const body = expression(1);
    if (tokens[index++] !== ')') throw Error('Add the closing parenthesis.');
    return values => functions[token](body(values));
  }
  function expression(level) {
    let left = atom();
    while (Object.hasOwn(precedence, tokens[index]) && precedence[tokens[index]] >= level) {
      const operator = tokens[index++];
      const before = left;
      const right = expression(precedence[operator] + (operator === '^' ? 0 : 1));
      left = values => operators[operator](before(values), right(values));
    }
    return left;
  }
  const evaluate = expression(1);
  if (index !== tokens.length) throw Error('Use * for multiplication and check parentheses.');
  return (x, y = 0) => evaluate({ x, y });
}

export function validateDomain(xmin, xmax, ymin, ymax) {
  if (![xmin, xmax, ymin, ymax].every(x => Number.isFinite(x) && Math.abs(x) <= 1e6) ||
      xmax - xmin < .00001 || ymax - ymin < .00001) {
    throw Error('Each axis needs bounds between −1,000,000 and 1,000,000, at least 0.00001 apart.');
  }
  return { xmin, xmax, ymin, ymax };
}

export function surfaceSamples(evaluate, domain, steps = 30) {
  const { xmin, xmax, ymin, ymax } = domain;
  return Array.from({length: steps+1}, (_, i) => Array.from({length: steps+1}, (_, j) => {
    const z = evaluate(xmin+(xmax-xmin)*j/steps, ymin+(ymax-ymin)*i/steps);
    return {x: 2*j/steps-1, y: 2*i/steps-1, z: Number.isFinite(z) ? z : null};
  }));
}

const examples = {
  ripple: ['3d', '2*sin(sqrt(x^2+y^2))', -8, 8, -8, 8],
  saddle: ['3d', 'x^2-y^2', -3, 3, -3, 3],
  hills: ['3d', 'cos(x)*sin(y)', -6, 6, -6, 6],
  sine: ['2d', 'sin(x)+0.4*cos(3*x)', -9, 9, -2, 2],
  cubic: ['2d', 'x^3-3*x', -4, 4, -8, 8],
  reciprocal: ['2d', '1/x', -6, 6, -4, 4],
};

function buildModel({ mode, source, evaluate }, domain) {
  const model = { mode, source, evaluate, domain };
  if (mode === '2d') {
    const { paths, hasFiniteSamples } = sampleCurve(evaluate, domain);
    if (!hasFiniteSamples) throw Error('The curve has no finite samples in this x-range.');
    return { ...model, paths };
  }

  const samples = surfaceSamples(evaluate, domain);
  const cells = surfaceCells(evaluate, domain, samples);
  if (!cells.length) throw Error('No drawable surface cells in these bounds. Try a smaller domain with finite values.');
  const values = cells.flatMap(([r, c]) => [
    samples[r][c].z, samples[r][c + 1].z, samples[r + 1][c].z, samples[r + 1][c + 1].z,
  ]);
  const limits = [Math.min(...values), Math.max(...values)];
  if (!Number.isFinite(limits[1] - limits[0])) throw Error('Surface values exceed the plot range.');
  return { ...model, samples, cells, limits };
}

function axisTicks(min, max, divisions) {
  const spacing = (max - min) / divisions;
  const magnitude = 10 ** Math.floor(Math.log10(spacing));
  const step = [1, 2, 5, 10].find(n => n * magnitude >= spacing) * magnitude;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const ticks = [];
  for (let i = Math.ceil(min / step); i * step <= max && ticks.length < 14; i++) {
    const value = i * step;
    ticks.push({ value, text: value.toFixed(decimals).replace('-', '−') });
  }
  return ticks;
}

function initialize() {
  const $ = id => document.getElementById(id);
  const chart = $('plot'), ctx = chart.getContext('2d');
  const axes = ['xmin', 'xmax', 'ymin', 'ymax'];
  const reading = $('reading'), details = $('plot-details'), help = $('plot-help'), error = $('error');
  let W = 0, H = 0, pixelRatio = 0;
  let model, plotBounds, yaw = -.65, pitch = .57, drag;
  const fmt = n => Number(n.toPrecision(12)).toString().replace('-', '−');
  const plotFont = () => (W < 440 ? 12 : 14) + 'px system-ui';
  function line(points, color = '#785e90', width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.stroke();
  }
  function label(text, x, y, color = '#d7c6e8', align = 'left') {
    ctx.fillStyle = color;
    ctx.font = plotFont();
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
  }
  function paint2d({ paths, domain }) {
    const { xmin, xmax, ymin, ymax } = domain;
    const right = W - 22, bottom = H - 44, top = 24;
    const ys = axisTicks(ymin, ymax, Math.max(2, Math.floor((bottom - top) / 39)));
    ctx.font = plotFont();
    const left = Math.max(36, ...ys.map(tick => ctx.measureText(tick.text).width + 14));
    const xs = axisTicks(xmin, xmax, Math.max(2, Math.floor((right - left) / 92)));
    plotBounds = { width: right - left, height: bottom - top };
    const X = x => left + (x - xmin) * plotBounds.width / (xmax - xmin);
    const Y = y => bottom - (y - ymin) * plotBounds.height / (ymax - ymin);
    for (const { value, text } of xs) {
      const x = X(value);
      const halfWidth = ctx.measureText(text).width / 2;
      line([[x, top], [x, bottom]], value === 0 ? '#ac93c5' : '#392d46');
      label(text, Math.max(halfWidth + 5, Math.min(W - halfWidth - 5, x)), bottom + 18, undefined, 'center');
    }
    for (const { value, text } of ys) {
      const y = Y(value);
      line([[left, y], [right, y]], value === 0 ? '#ac93c5' : '#392d46');
      label(text, left - 8, y + 4, undefined, 'right');
    }
    label('x', right, H - 9);
    label('y', left, top - 7);

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, plotBounds.width, plotBounds.height);
    ctx.clip();
    ctx.strokeStyle = '#78e8de';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (const path of paths) {
      const [first, ...rest] = path;
      ctx.moveTo(X(first[0]), Y(first[1]));
      for (const [x, y] of rest) ctx.lineTo(X(x), Y(y));
    }
    ctx.stroke();
    ctx.restore();
  }
  function paint3d({ samples, cells, limits }) {
    const [low, high] = limits;
    const span=high-low;
    const scale=Math.min(W,H)*.273;
    const project=(x,y,z) => {
      const ix=x*Math.cos(yaw)-y*Math.sin(yaw);
      const iy=x*Math.sin(yaw)+y*Math.cos(yaw);
      return [W*.50+ix*scale,H*.475+(iy*Math.sin(pitch)-z*Math.cos(pitch))*scale,
        iy*Math.cos(pitch)+z*Math.sin(pitch)];
    };
    const projected=samples.map(row=>row.map(({x,y,z})=>z===null?null:project(x,y,span ? (z-low)/span*1.55-.775 : 0)));
    const tiles = cells.map(([row, col]) => {
      const points = [projected[row][col], projected[row][col + 1], projected[row + 1][col + 1], projected[row + 1][col]];
      const z = samples[row][col].z;
      return { points, depth: points.reduce((sum, point) => sum + point[2], 0), hue: span ? 192 + 87 * (z - low) / span : 235 };
    });
    tiles.sort((a,b)=>a.depth-b.depth);
    const axes=[['x',project(1.23,-1,-.92),'#9fe8e0'],['y',project(-1,1.23,-.92),'#edc8ff'],['z',project(-1,-1,1.13),'#ffd4a2']];
    for(const [,point,color] of axes)line([project(-1,-1,-.92),point],color,1.6);
    for(const {points,hue} of tiles){
      ctx.beginPath();
      points.forEach(([x,y],i)=>i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
      ctx.closePath();
      ctx.fillStyle='hsl('+hue+' 69% 50%)';ctx.fill();
      ctx.strokeStyle='rgba(235,225,253,.37)';ctx.lineWidth=.85;ctx.stroke();
    }
    for(const [name,[x,y],color] of axes)label(name,x+5,y-4,color);
  }
  function paint() {
    if (!W || !H) return;
    ctx.fillStyle='#161121';ctx.fillRect(0,0,W,H);
    if(!model)return;
    if(model.mode==='2d')paint2d(model);
    else paint3d(model);
  }
  function resizePlot() {
    const width = chart.clientWidth, height = chart.clientHeight;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (width <= 0 || height <= 0 || (W === width && H === height && pixelRatio === ratio)) return;
    W = width;
    H = height;
    pixelRatio = ratio;
    chart.width = Math.round(W * ratio);
    chart.height = Math.round(H * ratio);
    ctx.setTransform(chart.width / W, 0, 0, chart.height / H, 0, 0);
    paint();
  }
  function showPlot(next) {
    model = next;
    const { mode, source, domain, paths, limits } = next;
    const surface = mode === '3d';
    const formula = (surface ? 'z = ' : 'y = ') + source;
    const range = (min, max) => fmt(min) + ' to ' + fmt(max);
    error.textContent = '';
    reading.textContent = formula;
    details.textContent = 'x ' + range(domain.xmin, domain.xmax) + ' · y ' + range(domain.ymin, domain.ymax) +
      (surface ? ' · Sampled z ' + range(...limits) : paths.length ? '' : ' · Curve outside the visible y-range or too sparse to draw.');
    help.textContent = 'Drag or use arrow keys to ' + (surface ? 'rotate the surface.' : 'pan the curve.');
    $('rotate-controls').hidden = !surface;
    chart.setAttribute('aria-label', (surface ? '3D surface for ' : '2D graph for ') + formula);
    paint();
  }
  function reportError(problem) {
    error.textContent = problem.message + (model ? ' The previous plot is still shown.' : '');
  }
  function refresh() {
    try {
      const mode = $('mode').value;
      const source = $('formula').value.trim();
      const domain = validateDomain(...axes.map(id => $(id).valueAsNumber));
      const evaluate = compileExpression(source, mode === '2d' ? ['x'] : ['x', 'y']);
      showPlot(buildModel({ mode, source, evaluate }, domain));
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
    if ($('mode').value !== model.mode || $('formula').value.trim() !== model.source ||
        axes.some(id => $(id).valueAsNumber !== model.domain[id])) {
      error.textContent = 'Plot your edits before panning or zooming.';
      return false;
    }
    return true;
  }
  function setExample(name) {
    const example = examples[name];
    if (!example) return;
    const [mode, expr, ...bounds] = example;
    $('mode').value = mode;
    $('formula').value = expr;
    writeBounds(bounds);
    yaw = -.65;
    pitch = .57;
    refresh();
  }
  $('example').addEventListener('change',()=>setExample($('example').value));
  $('mode').addEventListener('change', () => {
    $('example').value = '';
    refresh();
  });
  $('controls').addEventListener('input', event => {
    if (event.target.id === 'formula' || axes.includes(event.target.id)) $('example').value = '';
  });
  $('controls').addEventListener('submit',event=>{event.preventDefault();refresh();});
  function zoom(factor) {
    if (!canChangeBounds()) return;
    const { xmin, xmax, ymin, ymax } = model.domain;
    const adjust = (min, max) => {
      const delta = (max - min) * (factor - 1) / 2;
      return [min - delta, max + delta];
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
    paint();
  }
  $('zoom-in').onclick = () => zoom(.8);
  $('zoom-out').onclick = () => zoom(1.25);
  $('turn-left').onclick = () => rotate(yaw - .27, pitch);
  $('turn-right').onclick = () => rotate(yaw + .27, pitch);

  const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  chart.addEventListener('keydown', event => {
    if (!model || event.altKey || event.ctrlKey || event.metaKey || !Object.hasOwn(movement, event.key)) return;
    event.preventDefault();
    const [x, y] = movement[event.key];
    if (model.mode === '3d') rotate(yaw + x * .17, pitch + y * .12);
    else if (canChangeBounds()) pan(model.domain, x * .08, y * .08);
  });
  chart.addEventListener('pointerdown', event => {
    if (drag || event.button !== 0 || !model || (model.mode === '2d' && !canChangeBounds())) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch, domain: model.domain, plotBounds };
    chart.setPointerCapture(event.pointerId);
    chart.style.cursor = 'grabbing';
  });
  chart.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (model.mode === '3d') rotate(drag.yaw + dx * .009, drag.pitch + dy * .008);
    else pan(drag.domain, -dx / drag.plotBounds.width, dy / drag.plotBounds.height);
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    chart.addEventListener(name, event => {
      if (drag?.id !== event.pointerId) return;
      drag = undefined;
      chart.style.cursor = '';
    });
  }
  new ResizeObserver(resizePlot).observe(chart);
  resizePlot();
  $('example').value = 'ripple';
  setExample('ripple');
}
if (typeof document !== 'undefined') initialize();
