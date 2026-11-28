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

export function imageForLens(distance, focalLength, objectHeight) {
  if (![distance, focalLength, objectHeight].every(Number.isFinite) || distance <= 0 ||
      focalLength === 0 || objectHeight <= 0) throw RangeError('Enter positive distances and a nonzero focal length.');
  if (distance === focalLength) return { kind: 'at infinity', distance: null, magnification: null, height: null };
  const location = distance * focalLength / (distance - focalLength);
  const magnification = -location / distance;
  return { kind: location < 0 ? 'virtual' : 'real', distance: location, magnification, height: magnification * objectHeight };
}

if (typeof document !== 'undefined') watchControls(() => {
  const distance = get('distance').valueAsNumber;
  const focal = get('focal').valueAsNumber * (get('lens-kind').value === 'diverging' ? -1 : 1);
  const objectHeight = 5;
  const image = imageForLens(distance, focal, objectHeight);
  const chart = plot({ xMin: -80, xMax: 80, yMin: -18, yMax: 18,
    xTicks: values(-80, 80, 8), yTicks: values(-18, 18, 6),
    xTitle: 'Distance along the optical axis (cm)', yTitle: 'Height (cm)' });
  chart.trace([[-80, 0], [80, 0]], 'quiet');
  chart.trace([[0, -18], [0, 18]], 'violet');
  chart.trace([[-distance, objectHeight], [0, objectHeight], [80, objectHeight * (1 - 80 / focal)]], 'cyan');
  chart.trace([[-distance, objectHeight], [0, 0], [80, -80 * objectHeight / distance]], 'amber');
  if (image.kind === 'virtual') {
    const left = Math.max(-80, image.distance);
    chart.trace([[0, objectHeight], [left, objectHeight * (1 - left / focal)]], 'cyan dashed');
    chart.trace([[0, 0], [left, -left * objectHeight / distance]], 'amber dashed');
  }
  for (const focus of [-Math.abs(focal), Math.abs(focal)]) {
    chart.dot(focus, 0, 'violet');
    chart.label(focus, -2.7, 'F', 'tick');
  }
  chart.trace([[-distance, 0], [-distance, objectHeight]], 'paper');
  chart.dot(-distance, objectHeight, 'paper');
  chart.label(-distance, objectHeight + 2.7, 'Object');
  const inFrame = image.distance !== null && Math.abs(image.distance) <= 80 && Math.abs(image.height) <= 18;
  if (inFrame) {
    chart.trace([[image.distance, 0], [image.distance, image.height]],
      image.kind === 'virtual' ? 'pink dashed' : 'pink');
    chart.dot(image.distance, image.height, 'pink');
    chart.label(image.distance, image.height + Math.sign(image.height) * 2.8, 'Image');
  }
  get('distance-value').value = distance + ' cm';
  get('focal-value').value = focal + ' cm';
  writeStats([['Image type', image.kind], ['Image position', image.distance === null ? '∞' : image.distance.toFixed(1) + ' cm'],
    ['Magnification', image.magnification === null ? '—' : image.magnification.toFixed(2) + '×']]);
  get('reading').textContent = image.kind === 'at infinity' ? 'The outgoing rays are parallel.'
    : image.kind === 'virtual' ? `The dashed extensions meet on the object side.${inFrame ? '' : ' The image lies outside the plotted window.'}`
    : `The refracted rays meet on the far side of the lens.${inFrame ? '' : ' The image lies outside the plotted window.'}`;
});
