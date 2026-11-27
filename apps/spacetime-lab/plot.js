const namespace = 'http://www.w3.org/2000/svg';

export function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS(namespace, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function ticks(min, max, count) {
  const target = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 2.5, 5, 10].find(value => value * power >= target) * power;
  const first = Math.ceil(min / step), last = Math.floor(max / step);
  return Array.from({ length: last - first + 1 }, (_, index) => (first + index) * step);
}

const axisNumber = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 });

export function makePlot(svg, options) {
  let { xMin, xMax, yMin, yMax } = options;
  const width = Math.max(280, Math.min(800, svg.clientWidth || 720));
  const narrow = width < 460;
  const height = narrow ? 320 : 430;
  const left = narrow ? 45 : 61, right = width - (narrow ? 16 : 23);
  const top = 31, bottom = height - 56;
  if (options.equalUnits) {
    const scale = Math.min((right - left) / (xMax - xMin), (bottom - top) / (yMax - yMin));
    const extraX = ((right - left) / scale - (xMax - xMin)) / 2;
    const extraY = ((bottom - top) / scale - (yMax - yMin)) / 2;
    xMin -= extraX;
    xMax += extraX;
    yMin -= extraY;
    yMax += extraY;
  }
  const x = value => left + (value - xMin) * (right - left) / (xMax - xMin);
  const y = value => bottom - (value - yMin) * (bottom - top) / (yMax - yMin);
  const clipId = svg.id + '-clip';
  const defs = svgNode('defs');
  const clip = svgNode('clipPath', { id: clipId });
  clip.append(svgNode('rect', { x: left, y: top, width: right - left, height: bottom - top }));
  defs.append(clip);
  const grid = svgNode('g', { class: 'plot-grid', 'aria-hidden': 'true' });
  const layer = svgNode('g', { 'clip-path': 'url(#' + clipId + ')' });
  for (const value of options.xTicks ?? ticks(xMin, xMax, narrow ? 4 : 7)) {
    if (value < xMin || value > xMax) continue;
    const px = x(value);
    grid.append(svgNode('line', { x1: px, y1: top, x2: px, y2: bottom, class: value === 0 ? 'zero' : '' }),
      svgNode('text', { x: px, y: bottom + 21, 'text-anchor': 'middle' }, axisNumber.format(value)));
  }
  for (const value of options.yTicks ?? ticks(yMin, yMax, 5)) {
    if (value < yMin || value > yMax) continue;
    const py = y(value);
    grid.append(svgNode('line', { x1: left, y1: py, x2: right, y2: py, class: value === 0 ? 'zero' : '' }),
      svgNode('text', { x: left - 8, y: py + 4, 'text-anchor': 'end' }, axisNumber.format(value)));
  }
  grid.append(
    svgNode('rect', { x: left, y: top, width: right - left, height: bottom - top }),
    svgNode('text', { class: 'axis-label', x: left, y: 20 }, options.yLabel),
    svgNode('text', { class: 'axis-label', x: (left + right) / 2, y: height - 13, 'text-anchor': 'middle' }, options.xLabel),
  );
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.replaceChildren(defs, grid, layer);

  function point(clientX, clientY) {
    const local = new DOMPoint(clientX, clientY).matrixTransform(svg.getScreenCTM().inverse());
    return {
      x: xMin + (local.x - left) * (xMax - xMin) / (right - left),
      y: yMin + (bottom - local.y) * (yMax - yMin) / (bottom - top),
    };
  }
  return { x, y, layer, point, xMin, xMax, yMin, yMax };
}
