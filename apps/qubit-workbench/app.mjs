import { applyGate, bloch, canonicalState, fromAngles, presetAngles, probability, sample, stateAngles } from './model.mjs?v=1';

const byId = id => document.getElementById(id);
const sphere = byId('sphere');
const mesh = byId('mesh');
const axes = byId('axes');
const vector = byId('vector');
const preset = byId('preset');
const theta = byId('theta');
const phi = byId('phi');
const basis = byId('basis');
const shots = byId('shots');
const operation = byId('operation');
const clear = byId('clear');
const ket = byId('ket');
const coordinates = byId('coordinates');
const arrowTip = ['X', 'Y', 'Z'];
const positive = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const outcomes = { X: ['|+⟩', '|−⟩'], Y: ['|+i⟩', '|−i⟩'], Z: ['|0⟩', '|1⟩'] };
const origin = [300, 190];
const radius = 142;
const home = { yaw: -0.55, pitch: 0.31 };
const camera = { ...home };
const formats = {
  percent: new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 }),
  number: new Intl.NumberFormat('en'),
};
const gateNames = {
  X: 'Pauli X', Y: 'Pauli Y', Z: 'Pauli Z', H: 'Hadamard', S: 'S phase gate', T: 'T phase gate',
};

let state = fromAngles(...presetAngles.tilted);
let tally = [0, 0];
let drag;
let frame = 0;

function svg(tag, attrs, content) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const name of Object.keys(attrs)) element.setAttribute(name, attrs[name]);
  if (content) element.textContent = content;
  return element;
}

function coordinateSystem() {
  const { yaw, pitch } = camera;
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  return ([x, y, z], scale = radius) => [
    origin[0] + (-sy * x + cy * y) * scale,
    origin[1] - (-sp * cy * x - sp * sy * y + cp * z) * scale,
    cp * cy * x + cp * sy * y + sp * z,
  ];
}

function circlePoints(point) {
  return Array.from({ length: 91 }, (_, index) => point(Math.PI * 2 * index / 90));
}

const latitudes = [-60, -30, 0, 30, 60].map(latitude => {
  const tilt = latitude * Math.PI / 180;
  const crossRadius = Math.cos(tilt);
  const z = Math.sin(tilt);
  return { equator: latitude === 0, points: circlePoints(angle => [crossRadius * Math.cos(angle), crossRadius * Math.sin(angle), z]) };
});

const meridians = Array.from({ length: 6 }, (_, index) => {
  const azimuth = Math.PI * index / 6;
  return { points: circlePoints(angle => [Math.cos(azimuth) * Math.cos(angle), Math.sin(azimuth) * Math.cos(angle), Math.sin(angle)]) };
});

function traceMesh(project, points, front) {
  let path = '';
  let inSegment = false;
  for (const point of points) {
    const [x, y, depth] = project(point);
    if ((depth > 0) === front) {
      path += (inSegment ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
      inSegment = true;
    } else {
      inSegment = false;
    }
  }
  return path;
}

function line(from, to, className) {
  return svg('line', { x1: from[0], y1: from[1], x2: to[0], y2: to[1], class: className });
}

function drawState(project = coordinateSystem()) {
  const [x, y, z] = bloch(state);
  const point = project([x, y, z]);
  const floor = project([x, y, 0]);
  const trace = svg('path', {
    d: 'M' + origin.join(' ') + 'L' + floor.slice(0, 2).join(' ') + 'L' + point.slice(0, 2).join(' '),
    class: 'state-trace',
  });
  vector.replaceChildren(trace);
  if (Math.hypot(point[0] - origin[0], point[1] - origin[1]) > 4) {
    vector.append(line(origin, point, 'state-line'));
  } else {
    vector.append(svg('circle', { cx: point[0], cy: point[1], r: 7, class: 'state-aligned' }));
  }
  vector.append(svg('circle', { cx: origin[0], cy: origin[1], r: 3, class: 'origin' }));
}

function drawSphere() {
  const project = coordinateSystem();
  const paths = [];
  for (const front of [false, true]) {
    for (const { points, equator } of [...latitudes, ...meridians]) {
      paths.push(svg('path', {
        class: 'mesh' + (front ? '' : ' behind') + (equator ? ' equator' : ''),
        d: traceMesh(project, points, front),
      }));
    }
  }
  mesh.replaceChildren(...paths);
  axes.replaceChildren(...positive.map((direction, index) => {
    const axis = arrowTip[index];
    const opposite = direction.map(value => -value);
    const edge = project(direction, radius * 1.09);
    const far = project(opposite, radius * 1.04);
    const label = project(direction, radius * 1.21);
    const group = svg('g', { class: axis.toLowerCase() + '-axis' });
    const text = axis === 'Z' ? '+Z  |0⟩' : '+' + axis;
    group.append(
      line(origin, far, 'axis-line negative'),
      line(origin, edge, 'axis-line'),
      svg('circle', { cx: edge[0], cy: edge[1], r: 2.6, class: 'axis-tick' }),
      svg('text', { x: label[0], y: label[1] + 4, 'text-anchor': 'middle', class: 'axis-label' }, text),
    );
    if (axis === 'Z') {
      const negative = project(opposite, radius * 1.21);
      group.append(svg('text', { x: negative[0], y: negative[1] + 4, 'text-anchor': 'middle', class: 'axis-label' }, '−Z  |1⟩'));
    }
    return group;
  }));
  drawState(project);
}

function updateCamera(yaw, pitch) {
  camera.yaw = yaw % (2 * Math.PI);
  camera.pitch = Math.min(1.27, Math.max(-1.27, pitch));
  if (!frame) frame = requestAnimationFrame(() => {
    frame = 0;
    drawSphere();
  });
}

function rounded(value) {
  return (Math.abs(value) < 0.0005 ? 0 : value).toFixed(3).replace(/\.?(?:0+)$/, '').replace('-', '−');
}

function displayAmplitude([real, imaginary]) {
  if (Math.abs(imaginary) < 0.0005) return rounded(real);
  if (Math.abs(real) < 0.0005) return rounded(imaginary) + 'i';
  return '(' + rounded(real) + (imaginary < 0 ? ' − ' : ' + ') + rounded(Math.abs(imaginary)) + 'i)';
}

function paintHistogram() {
  const chance = probability(state, basis.value);
  const probabilities = [chance, 1 - chance];
  const total = tally[0] + tally[1];
  probabilities.forEach((prediction, index) => {
    const observed = total > 0 ? tally[index] / total : 0;
    const summary = total > 0
      ? formats.number.format(tally[index]) + ' observed (' + formats.percent.format(observed) + ')'
      : '— observed';
    byId('label-' + index).textContent = outcomes[basis.value][index];
    byId('result-' + index).textContent = formats.percent.format(prediction) + ' predicted · ' + summary;
    byId('observed-' + index).style.width = observed * 100 + '%';
    byId('prediction-' + index).style.left = prediction * 100 + '%';
  });
  clear.disabled = total === 0;
  byId('shot-status').textContent = total ? formats.number.format(total) + ' shots in the current tally.' : 'No shots yet.';
}

function updateState(message, syncAngles = true) {
  const [a, b] = canonicalState(state);
  ket.textContent = displayAmplitude(a) + '|0⟩ + ' + displayAmplitude(b) + '|1⟩';
  const point = bloch(state);
  coordinates.textContent = '(' + point.map(rounded).join(', ') + ')';
  byId('sphere-title').textContent = 'Three-dimensional Bloch sphere. Qubit vector is ' + coordinates.textContent + '.';
  if (syncAngles) {
    const current = stateAngles(state);
    theta.value = Math.round(current.theta);
    if (current.phi !== null) phi.value = Math.round(current.phi) % 360;
  }
  byId('theta-value').textContent = theta.value + '°';
  byId('phi-value').textContent = phi.value + '°';
  if (message) operation.textContent = message;
  tally = [0, 0];
  paintHistogram();
  drawState();
}

preset.addEventListener('change', () => {
  const chosen = presetAngles[preset.value];
  if (!chosen) return;
  state = fromAngles(...chosen);
  theta.value = chosen[0];
  phi.value = chosen[1];
  updateState('Prepared ' + preset.selectedOptions[0].textContent + '.', false);
});

for (const angle of [theta, phi]) angle.addEventListener('input', () => {
  state = fromAngles(Number(theta.value), Number(phi.value));
  preset.value = 'custom';
  updateState('Prepared from the selected angles.', false);
});

document.querySelectorAll('[data-gate]').forEach(button => button.addEventListener('click', () => {
  const name = button.dataset.gate;
  state = applyGate(state, name);
  preset.value = 'custom';
  updateState(gateNames[name] + ' applied.');
}));

basis.addEventListener('change', () => {
  tally = [0, 0];
  paintHistogram();
});

byId('measure').addEventListener('click', () => {
  const batch = sample(state, basis.value, Number(shots.value));
  tally = [tally[0] + batch[0], tally[1] + batch[1]];
  paintHistogram();
});

clear.addEventListener('click', () => {
  tally = [0, 0];
  paintHistogram();
  byId('measure').focus({ preventScroll: true });
});

sphere.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, ...camera };
  sphere.setPointerCapture(drag.pointer);
});

sphere.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointer) return;
  updateCamera(drag.yaw - (event.clientX - drag.x) * 0.011, drag.pitch + (event.clientY - drag.y) * 0.011);
});

sphere.addEventListener('lostpointercapture', () => { drag = undefined; });
sphere.addEventListener('keydown', event => {
  const steps = { ArrowLeft: [0.13, 0], ArrowRight: [-0.13, 0], ArrowUp: [0, -0.13], ArrowDown: [0, 0.13] };
  const step = steps[event.key];
  if (!Array.isArray(step)) return;
  event.preventDefault();
  updateCamera(camera.yaw + step[0], camera.pitch + step[1]);
});

byId('reset-view').addEventListener('click', () => updateCamera(home.yaw, home.pitch));

drawSphere();
updateState();
