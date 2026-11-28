const svgNamespace = 'http://www.w3.org/2000/svg';
const get = id => document.getElementById(id);

function element(name, attributes, text) {
  const node = document.createElementNS(svgNamespace, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function plot({ xMin, xMax, yMin, yMax, xTicks, yTicks, xTitle, yTitle }) {
  const svg = get('plot'), left = 59, right = 658, top = 36, bottom = 282;
  const x = value => left + (right - left) * (value - xMin) / (xMax - xMin);
  const y = value => bottom - (bottom - top) * (value - yMin) / (yMax - yMin);
  const drawLine = (x1, y1, x2, y2, className) =>
    element('line', { x1, y1, x2, y2, class: className });
  const label = (xx, yy, value, anchor = 'middle') =>
    element('text', { x: xx, y: yy, 'text-anchor': anchor, class: 'tick' }, value);
  const format = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  const defs = element('defs', {});
  const clip = element('clipPath', { id: 'plot-window' });
  clip.append(element('rect', { x: left, y: top, width: right - left, height: bottom - top }));
  defs.append(clip);
  svg.replaceChildren(defs, element('rect', { x: left, y: top, width: right - left, height: bottom - top, class: 'box' }));
  for (const tick of xTicks) {
    svg.append(drawLine(x(tick), top, x(tick), bottom, 'grid'), label(x(tick), bottom + 23, format(tick)));
  }
  for (const tick of yTicks) {
    svg.append(drawLine(left, y(tick), right, y(tick), 'grid'), label(left - 9, y(tick) + 4, format(tick), 'end'));
  }
  svg.append(label(left, top - 14, yTitle, 'start'), label((left + right) / 2, 332, xTitle));
  const layers = element('g', { 'clip-path': 'url(#plot-window)' });
  svg.append(layers);
  return {
    trace(points, className) {
      const data = points.map(([xx, yy], i) => (i ? 'L' : 'M') + x(xx).toFixed(3) + ',' + y(yy).toFixed(3)).join(' ');
      layers.append(element('path', { d: data, class: className }));
    },
    dot(xx, yy, className) {
      layers.append(element('circle', { cx: x(xx), cy: y(yy), r: 4.5, class: className }));
    },
    label(xx, yy, value, className = 'tick', anchor = 'middle') {
      layers.append(element('text', { x: x(xx), y: y(yy), class: className, 'text-anchor': anchor }, value));
    },
  };
}

function values(from, to, steps) {
  return Array.from({ length: steps + 1 }, (_, index) => from + (to - from) * index / steps);
}

function writeStats(items) {
  get('stats').replaceChildren(...items.map(([label, value]) => {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    const content = document.createElement('dd');
    term.textContent = label;
    content.textContent = value;
    item.append(term, content);
    return item;
  }));
}

function watchControls(draw) {
  const form = get('experiment-options');
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', draw);
  draw();
}

export function response(drive, natural, damping) {
  if (![drive, natural, damping].every(Number.isFinite) || drive < 0 || natural <= 0 || damping <= 0) {
    throw RangeError('Use a nonnegative drive frequency and positive natural frequency and damping.');
  }
  const ratio = drive / natural;
  const stiffness = 1 - ratio ** 2;
  const friction = 2 * damping * ratio;
  return { amplitude: 1 / Math.hypot(stiffness, friction), phase: Math.atan2(friction, stiffness) * 180 / Math.PI };
}

export function peakFrequency(natural, damping) {
  return natural * Math.sqrt(Math.max(0, 1 - 2 * damping ** 2));
}

if (typeof document !== 'undefined') watchControls(() => {
  const natural = get('natural').valueAsNumber;
  const damping = get('damping').valueAsNumber;
  const drive = get('drive').valueAsNumber;
  const atDrive = response(drive, natural, damping);
  const peak = peakFrequency(natural, damping);
  const maxDrive = 150;
  const maxAmplitude = Math.ceil(response(peak, natural, damping).amplitude * 1.1);
  const chart = plot({ xMin: 0, xMax: maxDrive, yMin: 0, yMax: maxAmplitude,
    xTicks: values(0, maxDrive, 5), yTicks: values(0, maxAmplitude, 4),
    xTitle: 'Drive frequency (Hz)', yTitle: 'Amplitude / static displacement' });
  const samples = values(0, maxDrive, 360).concat([drive, peak]).sort((a, b) => a - b);
  const curve = samples.map(point => [point, response(point, natural, damping).amplitude]);
  chart.trace([[0, 1], [maxDrive, 1]], 'quiet dashed');
  chart.trace(curve, 'cyan');
  chart.trace([[drive, 0], [drive, atDrive.amplitude]], 'amber dashed');
  chart.dot(drive, atDrive.amplitude, 'amber');
  if (peak > 0) chart.dot(peak, response(peak, natural, damping).amplitude, 'violet');
  get('natural-value').value = natural + ' Hz';
  get('damping-value').value = damping.toFixed(2);
  get('drive-value').value = drive + ' Hz';
  writeStats([['Amplification', atDrive.amplitude.toFixed(3) + '×'], ['Phase lag', atDrive.phase.toFixed(1) + '°'],
    ['Peak frequency', peak ? peak.toFixed(2) + ' Hz' : '0 Hz']]);
  get('reading').textContent = peak > 0
    ? 'The violet point marks peak displacement. The amber point tracks your drive frequency.'
    : 'At this damping ratio the largest displacement occurs at zero frequency.';
});
