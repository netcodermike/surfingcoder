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

export function panGains(position, law) {
  if (!Number.isFinite(position) || Math.abs(position) > 1) throw RangeError('Pan must be between −1 and 1.');
  const rightFraction = (position + 1) / 2;
  if (law === 'linear') return [1 - rightFraction, rightFraction];
  if (law !== 'equal') throw RangeError('Choose linear or equal-power panning.');
  return [Math.cos(rightFraction * Math.PI / 2), Math.sin(rightFraction * Math.PI / 2)];
}

const power = pair => pair[0] ** 2 + pair[1] ** 2;
const decibels = gain => gain < 1e-12 ? '−∞ dB' : (20 * Math.log10(gain)).toFixed(2) + ' dB';

if (typeof document !== 'undefined') watchControls(() => {
  const position = get('pan').valueAsNumber;
  const law = get('law').value;
  const gains = panGains(position, law);
  const otherLaw = law === 'equal' ? 'linear' : 'equal';
  const chart = plot({ xMin: -1, xMax: 1, yMin: 0, yMax: 1.1,
    xTicks: values(-1, 1, 4), yTicks: values(0, 1, 4), xTitle: 'Pan position (−1 left, +1 right)', yTitle: 'Relative gain or power' });
  const pans = values(-1, 1, 160);
  const channels = pans.map(point => panGains(point, law));
  chart.trace(pans.map(point => [point, power(panGains(point, otherLaw))]), 'quiet dashed');
  chart.trace(pans.map((point, index) => [point, channels[index][0]]), 'violet');
  chart.trace(pans.map((point, index) => [point, channels[index][1]]), 'cyan');
  chart.trace(pans.map((point, index) => [point, power(channels[index])]), 'amber');
  chart.trace([[position, 0], [position, 1.1]], 'quiet dashed');
  chart.dot(position, gains[0], 'violet');
  chart.dot(position, gains[1], 'cyan');
  chart.dot(position, power(gains), 'amber');
  get('pan-value').value = position.toFixed(2);
  writeStats([['Left gain', decibels(gains[0])], ['Right gain', decibels(gains[1])],
    ['Combined power', (power(gains) * 100).toFixed(1) + '%']]);
  get('reading').textContent = law === 'equal'
    ? 'Equal-power panning keeps the sum of the two squared gains at 100%.'
    : 'Linear panning keeps the gains adding to one. The combined power falls near the center.';
});
