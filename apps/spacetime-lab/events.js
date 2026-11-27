import { compareEvents } from './physics.js?v=1';
import { makePlot, svgNode } from './plot.js?v=1';

const plotBounds = {
  xMin: -6, xMax: 6, yMin: -4, yMax: 4,
  xLabel: 'Position (light-years)', yLabel: 'Earth time (years)',
  equalUnits: true, xTicks: [-6, -4, -2, 0, 2, 4, 6], yTicks: [-4, -2, 0, 2, 4],
};
const presets = {
  spacelike: { a: { x: -2, t: 0 }, b: { x: 2, t: 1 } },
  lightlike: { a: { x: -1, t: -.5 }, b: { x: 1, t: 1.5 } },
  timelike: { a: { x: -1, t: -1 }, b: { x: -1, t: 2 } },
};
const orderLabels = { 'a-first': 'A before B', 'b-first': 'B before A', simultaneous: 'Simultaneous' };
const separationDetails = {
  timelike: ['Timelike', 'A signal moving slower than light could connect the events. Their order is the same in every inertial frame.'],
  lightlike: ['Lightlike', 'A light signal could connect these events. Their order is the same in every inertial frame.'],
  spacelike: ['Spacelike', 'The events are too far apart to influence each other at or below light speed. Their order can change with the reference frame.'],
  coincident: ['Coincident', 'A and B are the same event in every inertial frame.'],
};
const signed = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3, signDisplay: 'exceptZero' });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function formatSigned(value) {
  if (value !== 0 && Math.abs(value) < .0005) return value.toExponential(1).replaceAll('-', '−');
  return signed.format(value).replace('-', '−');
}

function paintEvent(plot, key, position) {
  const color = key === 'a' ? 'var(--ship)' : 'var(--earth)';
  const marker = svgNode('g', {
    'data-event-marker': key,
    transform: `translate(${plot.x(position.x)} ${plot.y(position.t)})`,
    cursor: 'grab',
  });
  marker.append(
    svgNode('circle', { r: 22, fill: 'transparent' }),
    svgNode('circle', { r: 12, fill: color, stroke: 'var(--canvas-bg)', 'stroke-width': 2 }),
    svgNode('text', {
      y: 1, fill: 'var(--chart-marker-text, #1d1924)', 'font-size': 13, 'font-weight': 800,
      'text-anchor': 'middle', 'dominant-baseline': 'middle', 'pointer-events': 'none',
    }, key.toUpperCase())
  );
  plot.layer.append(marker);
}

export function initEvents() {
  const element = id => document.getElementById(id);
  const diagram = element('event-diagram');
  const speed = element('event-speed');
  const buttons = [...element('event-panel').querySelectorAll('[data-event-preset]')];
  const fields = {
    a: { x: element('event-a-x'), t: element('event-a-t') },
    b: { x: element('event-b-x'), t: element('event-b-t') },
  };
  const state = { a: { ...presets.spacelike.a }, b: { ...presets.spacelike.b }, preset: 'spacelike' };
  let plot;
  let drag;

  function draw() {
    const beta = speed.valueAsNumber;
    const result = compareEvents(state.a, state.b, beta);
    const earth = compareEvents(state.a, state.b, 0);
    const betaText = beta > 0 ? '+' + beta.toFixed(2) : beta.toFixed(2).replace('-', '−');
    element('event-speed-value').textContent = betaText + ' c';
    element('event-earth-order').textContent = orderLabels[earth.order];
    element('event-moving-order').textContent = orderLabels[result.order];
    element('event-delta-t').textContent = formatSigned(result.deltaT) + ' yr';
    element('event-interval').textContent = formatSigned(result.intervalSquared) + ' ly²';
    const [label, description] = separationDetails[result.separation];
    const strong = document.createElement('strong');
    strong.textContent = label;
    element('event-separation').replaceChildren(strong, ' · ' + description);
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.eventPreset === state.preset));
    }
    diagram.setAttribute('aria-label', `Earth-frame diagram. Event A at ${state.a.x} light-years and ${state.a.t} years. Event B at ${state.b.x} light-years and ${state.b.t} years.`);
    plot = makePlot(diagram, plotBounds);
    const a = state.a;
    const coordinates = (x, t) => `${plot.x(x)},${plot.y(t)}`;
    const origin = coordinates(a.x, a.t);
    const extent = 12;
    const cones = [1, -1].map(direction => {
      const t = a.t + direction * extent;
      return `M${origin}L${coordinates(a.x - extent, t)}L${coordinates(a.x + extent, t)}Z`;
    }).join(' ');
    plot.layer.append(svgNode('path', {
      d: cones, fill: 'var(--ship)', 'fill-opacity': .12,
      stroke: 'var(--ship)', 'stroke-opacity': .65, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke',
    }));
    const lineAt = x => a.t + beta * (x - a.x);
    plot.layer.append(svgNode('line', {
      x1: plot.x(plot.xMin), y1: plot.y(lineAt(plot.xMin)),
      x2: plot.x(plot.xMax), y2: plot.y(lineAt(plot.xMax)),
      stroke: 'var(--warm)', 'stroke-width': 1.6, 'stroke-dasharray': '6 5', 'vector-effect': 'non-scaling-stroke',
    }));
    paintEvent(plot, 'a', state.a);
    paintEvent(plot, 'b', state.b);
  }

  function syncFields() {
    for (const [key, coordinates] of Object.entries(fields)) {
      for (const [axis, input] of Object.entries(coordinates)) input.value = state[key][axis];
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      state.preset = button.dataset.eventPreset;
      for (const key of ['a', 'b']) state[key] = { ...presets[state.preset][key] };
      syncFields();
      draw();
    });
  }
  for (const [key, coordinates] of Object.entries(fields)) {
    for (const [axis, input] of Object.entries(coordinates)) {
      input.addEventListener('input', () => {
        const value = input.valueAsNumber;
        if (!Number.isFinite(value)) return;
        state[key][axis] = clamp(value, Number(input.min), Number(input.max));
        state.preset = null;
        draw();
      });
      input.addEventListener('change', () => {
        input.value = state[key][axis];
      });
    }
  }
  speed.addEventListener('input', draw);

  diagram.addEventListener('pointerdown', event => {
    const marker = event.target.closest('[data-event-marker]');
    if (event.button !== 0 || !marker || drag) return;
    drag = { key: marker.dataset.eventMarker, pointerId: event.pointerId };
    diagram.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  diagram.addEventListener('pointermove', event => {
    if (drag?.pointerId !== event.pointerId) return;
    const { x, y } = plot.point(event.clientX, event.clientY);
    const key = drag.key;
    state[key] = { x: clamp(Math.round(x * 10) / 10, -5, 5), t: clamp(Math.round(y * 10) / 10, -3, 3) };
    state.preset = null;
    syncFields();
    draw();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    diagram.addEventListener(name, event => {
      if (drag?.pointerId === event.pointerId) drag = undefined;
    });
  }

  return { draw };
}
