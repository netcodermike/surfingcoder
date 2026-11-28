import { createPacket, planeTransmission, presets } from './model.mjs';

const byId = id => document.getElementById(id);
const canvas = byId('plot');
const context = canvas.getContext('2d');
const lab = document.querySelector('.tunnel-lab');
const fields = Object.fromEntries(['energy', 'height', 'width'].map(key => [key, byId(key)]));
const resultKeys = ['left', 'inside', 'right'];
const resultFields = resultKeys.map(byId);
const distribution = [...lab.querySelectorAll('.distribution span')];
const preset = byId('preset');
const play = byId('play');
const jump = byId('jump');
const speed = byId('speed');
const progress = byId('progress');
const clock = byId('clock');
const norm = byId('norm');
const status = byId('plot-note');
const prediction = byId('prediction');
const regime = byId('regime');
const percent = (value, places = 2) => (100 * value).toFixed(places) + '%';
const settingNumber = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const PLOT_LIMIT = 28;

let config;
let packet;
let mode = 'paused';
let frameId = 0;
let previousTime;
let stepRemainder = 0;
let colors;

function loadColors() {
  const css = getComputedStyle(lab);
  colors = {};
  for (const key of ['plot', 'grid', 'edge', 'muted', 'density', 'density-wash', 'barrier', 'barrier-wash', 'energy']) {
    colors[key] = css.getPropertyValue('--' + key).trim();
  }
}

function label(text, x, y, color, align = 'center') {
  context.fillStyle = color;
  context.textAlign = align;
  context.fillText(text, x, y);
}

function segment(x1, y1, x2, y2, color) {
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function drawPlot() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!context || !width || !height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  context.fillStyle = colors.plot;
  context.fillRect(0, 0, width, height);
  context.font = '11px "Segoe UI", system-ui, sans-serif';
  context.lineWidth = 1;

  const compact = width < 420;
  const left = compact ? 38 : 47, right = width - (compact ? 31 : 42);
  const top = 31, bottom = height - 38;
  const mapX = x => left + (x + PLOT_LIMIT) / (2 * PLOT_LIMIT) * (right - left);
  const first = Math.ceil((-PLOT_LIMIT - packet.x0) / packet.dx);
  const last = Math.floor((PLOT_LIMIT - packet.x0) / packet.dx);
  const density = new Float64Array(last - first + 1);
  let highest = 0;
  for (let i = 0; i < density.length; i++) {
    density[i] = packet.density(first + i);
    highest = Math.max(highest, density[i]);
  }

  const densityStep = Math.max(.01, Math.ceil(highest * 1.07 / .04) * .01);
  const energyStep = Math.max(.25, Math.ceil(Math.max(config.energy, config.height) * 1.08) / 4);
  const mapDensity = value => bottom - value / (4 * densityStep) * (bottom - top);
  const mapEnergy = value => bottom - value / (4 * energyStep) * (bottom - top);
  const barrierLeft = mapX(-config.width / 2), barrierRight = mapX(config.width / 2);
  const barrierTop = mapEnergy(config.height);
  const energyY = mapEnergy(config.energy);

  label('Density |ψ|²', 9, 19, colors.density, 'left');
  label('Energy', width - 9, 19, colors.barrier, 'right');
  for (let tick = 0; tick <= 4; tick++) {
    const y = bottom - tick * (bottom - top) / 4;
    segment(left, y, right, y, colors.grid);
    label((tick * densityStep).toFixed(2), left - 7, y + 4, colors.muted, 'right');
    label(String(tick * energyStep), right + 6, y + 4, colors.muted, 'left');
  }
  for (const tick of compact ? [-20, -10, 0, 10, 20] : [-28, -21, -14, -7, 0, 7, 14, 21, 28]) {
    const x = mapX(tick);
    segment(x, top, x, bottom, colors.grid);
    label(String(tick), x, bottom + 16, colors.muted);
  }
  label('Position x', width / 2, height - 8, colors.muted);

  context.fillStyle = colors['barrier-wash'];
  context.fillRect(barrierLeft, barrierTop, barrierRight - barrierLeft, bottom - barrierTop);
  context.strokeStyle = colors.barrier;
  context.beginPath();
  context.moveTo(left, bottom);
  context.lineTo(barrierLeft, bottom);
  context.lineTo(barrierLeft, barrierTop);
  context.lineTo(barrierRight, barrierTop);
  context.lineTo(barrierRight, bottom);
  context.lineTo(right, bottom);
  context.stroke();
  context.setLineDash([5, 5]);
  segment(left, energyY, right, energyY, colors.energy);
  context.setLineDash([]);
  segment(left, top, left, bottom, colors.edge);
  segment(right, top, right, bottom, colors.edge);

  context.beginPath();
  for (let i = 0; i < density.length; i++) {
    const x = mapX(packet.x0 + (first + i) * packet.dx);
    const y = mapDensity(density[i]);
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = colors.density;
  context.lineWidth = 2.3;
  context.stroke();
  context.lineWidth = 1;
  context.lineTo(mapX(packet.x0 + last * packet.dx), bottom);
  context.lineTo(mapX(packet.x0 + first * packet.dx), bottom);
  context.closePath();
  context.fillStyle = colors['density-wash'];
  context.fill();
}

function render() {
  const positions = packet.probabilities();
  const total = resultKeys.reduce((sum, key) => sum + positions[key], 0);
  resultKeys.forEach((key, i) => {
    resultFields[i].textContent = percent(positions[key]);
    distribution[i].style.width = percent(positions[key], 5);
  });
  norm.textContent = 'Total ' + percent(total);
  progress.style.width = percent(packet.time / packet.duration, 3);
  clock.textContent = 't = ' + packet.time.toFixed(2);
  drawPlot();
}

function updateButtons() {
  play.textContent = packet.finished ? 'Replay packet' : mode === 'playing' ? 'Pause' : packet.time ? 'Resume' : 'Play packet';
  play.disabled = mode === 'jumping';
  jump.disabled = mode === 'jumping' || packet.finished;
}

function stop() {
  cancelAnimationFrame(frameId);
  mode = 'paused';
  frameId = 0;
  previousTime = undefined;
  stepRemainder = 0;
}

function prepare() {
  stop();
  config = {};
  for (const [key, input] of Object.entries(fields)) {
    config[key] = Number(input.value);
    byId(key + '-value').textContent = settingNumber.format(config[key]);
  }
  packet = createPacket(config);
  prediction.textContent = percent(planeTransmission(config));
  const excess = config.energy - config.height;
  regime.textContent = Math.abs(excess) < 1e-9 ? 'At barrier height'
    : excess > 0 ? 'Above barrier height' : 'Below barrier height';
  status.textContent = 'Packet ready on the left.';
  updateButtons();
  render();
}

function frame(time) {
  frameId = 0;
  if (mode === 'jumping') {
    packet.advance(74);
  } else {
    const elapsed = previousTime === undefined ? 0 : Math.min(60, time - previousTime);
    const available = stepRemainder + elapsed * .0055 * Number(speed.value) / packet.dt;
    const steps = Math.floor(available);
    stepRemainder = available - steps;
    previousTime = time;
    packet.advance(steps);
  }
  render();
  if (packet.finished) {
    stop();
    status.textContent = 'Run complete. The right-side probability estimates transmission for this packet.';
    updateButtons();
  } else {
    frameId = requestAnimationFrame(frame);
  }
}

function run(nextMode) {
  if (packet.finished) prepare();
  mode = nextMode;
  status.textContent = nextMode === 'jumping' ? 'Evolving the packet to the end of the run…' : 'Packet in motion.';
  updateButtons();
  if (!frameId) frameId = requestAnimationFrame(frame);
}

preset.onchange = () => {
  const values = presets[preset.value];
  if (!values) return;
  for (const [key, value] of Object.entries(values)) fields[key].value = value;
  prepare();
};
for (const field of Object.values(fields)) {
  field.oninput = () => {
    preset.value = 'custom';
    prepare();
  };
}
play.onclick = () => {
  if (mode !== 'playing') return run('playing');
  stop();
  status.textContent = 'Paused at t = ' + packet.time.toFixed(2) + '.';
  updateButtons();
};
byId('restart').onclick = prepare;
jump.onclick = () => run('jumping');

loadColors();
prepare();
new ResizeObserver(drawPlot).observe(canvas);
new MutationObserver(() => {
  loadColors();
  drawPlot();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
