import { BIN_COUNT, BIN_WIDTH_MM, HALF_SCREEN_MM, fringeSpacing, makeDistribution } from './model.mjs';

const get = id => document.getElementById(id);
const canvas = get('detector');
const context = canvas.getContext('2d');
const wavelength = get('wavelength');
const separation = get('separation');
const run = get('run');
const step = get('step');
const batch = get('batch');
const pointLimit = 18000;
const hitsPerSecond = 150;
const counter = new Intl.NumberFormat('en-US');
const notes = {
  single: 'A finite slit spreads the beam. The wide central band is bordered by much fainter side bands.',
  coherent: 'The two paths add as amplitudes, creating bright fringes where they reinforce and dark gaps where they cancel.',
  distinguished: 'An ideal detector records the path, so probabilities add. The single-slit envelope remains, while the two-path fringes disappear.',
};

let settings;
let distribution;
let palette;
let count = 0;
let centralCount = 0;
let running = false;
let example = true;
let animationFrame;
let previousFrame;
let credit = 0;
const positions = new Float32Array(pointLimit);
const levels = new Float32Array(pointLimit);
const bins = new Uint32Array(BIN_COUNT);

function readColors() {
  const style = getComputedStyle(canvas);
  const ink = name => style.getPropertyValue('--lab-' + name).trim();
  palette = {
    background: ink('plot'), detector: ink('detector'), grid: ink('grid'),
    text: ink('muted'), hits: ink('mark'), measured: ink('measured'), theory: ink('accent'),
  };
}

function addHits(amount, random = Math.random) {
  const end = Math.min(count + amount, pointLimit);
  for (; count < end; count++) {
    const position = distribution.sample(random);
    positions[count] = position;
    levels[count] = random();
    const bin = Math.min(BIN_COUNT - 1, Math.floor((position + HALF_SCREEN_MM) / BIN_WIDTH_MM));
    bins[bin]++;
    if (Math.abs(position) <= 1) centralCount++;
  }
}

function refreshStats() {
  const formattedCount = counter.format(count);
  const spacing = fringeSpacing(settings);
  get('hit-count').textContent = formattedCount;
  get('spacing').textContent = spacing === null ? '—' : spacing.toFixed(2) + ' mm';
  get('central-share').textContent = count ? (100 * centralCount / count).toFixed(1) + '%' : '—';
  get('sample-label').textContent = count === pointLimit ? 'Detector full' : example ? 'Example run' : '';
  get('detector-summary').textContent = formattedCount + ' recorded hits. ' +
    (spacing === null ? 'No two-path fringes.' : 'Central fringes are approximately ' + spacing.toFixed(2) + ' millimeters apart.') +
    (count ? ' ' + get('central-share').textContent + ' of hits lie within 1 millimeter of the center.' : '');
  for (const control of [run, step, batch]) control.disabled = count === pointLimit;
}

function draw() {
  refreshStats();
  if (!context) return;
  const { width, height } = canvas.getBoundingClientRect();
  if (width < 1 || height < 1) return;
  const ratio = Math.min(devicePixelRatio || 1, 3);
  const physicalWidth = Math.round(width * ratio);
  const physicalHeight = Math.round(height * ratio);
  if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
    canvas.width = physicalWidth;
    canvas.height = physicalHeight;
  }
  context.setTransform(physicalWidth / width, 0, 0, physicalHeight / height, 0, 0);
  const left = 40;
  const right = width - 15;
  const detectorTop = 31;
  const detectorBottom = height * .43;
  const top = detectorBottom + 38;
  const bottom = height - 41;
  const plotWidth = right - left;
  const x = position => left + (position + HALF_SCREEN_MM) * plotWidth / (2 * HALF_SCREEN_MM);
  const sampleDensity = bin => count ? bins[bin] / (count * BIN_WIDTH_MM) : 0;
  const peak = Math.max(distribution.density(0), ...Array.from(bins, (_, index) => sampleDensity(index)));
  const niceStep = Math.max(5, Math.ceil(100 * peak / 15) * 5);
  const y = density => bottom - density * 100 * (bottom - top) / (3 * niceStep);

  context.globalAlpha = 1;
  context.fillStyle = palette.background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = palette.detector;
  context.fillRect(left, detectorTop, plotWidth, detectorBottom - detectorTop);
  context.strokeStyle = palette.grid;
  context.lineWidth = 1;
  context.strokeRect(left + .5, detectorTop + .5, plotWidth - 1, detectorBottom - detectorTop - 1);
  context.font = '12px system-ui, sans-serif';
  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.fillStyle = palette.text;
  context.fillText('Detector impacts', left, 16);
  context.fillText('Probability density (% per mm)', left, detectorBottom + 19);
  context.beginPath();
  for (let tick = 0; tick < 4; tick++) {
    const yy = y(tick * niceStep / 100);
    context.moveTo(left, yy);
    context.lineTo(right, yy);
  }
  const stepX = width < 440 ? 5 : 2.5;
  for (let tick = -HALF_SCREEN_MM; tick <= HALF_SCREEN_MM; tick += stepX) {
    const xx = x(tick);
    context.moveTo(xx, top);
    context.lineTo(xx, bottom);
  }
  context.stroke();

  context.textAlign = 'right';
  for (let tick = 0; tick < 4; tick++) {
    context.fillText(String(tick * niceStep), left - 7, y(tick * niceStep / 100));
  }
  context.textAlign = 'center';
  for (let tick = -HALF_SCREEN_MM; tick <= HALF_SCREEN_MM; tick += stepX) {
    context.fillText(String(tick).replace('-', '−'), x(tick), bottom + 12);
  }
  context.fillText('Position on screen (mm)', left + plotWidth / 2, bottom + 29);

  context.fillStyle = palette.hits;
  context.globalAlpha = Math.max(.34, .78 - count / 16000);
  context.beginPath();
  for (let index = 0; index < count; index++) {
    const xx = x(positions[index]);
    const yy = detectorTop + 3 + levels[index] * (detectorBottom - detectorTop - 6);
    context.moveTo(xx + 1.22, yy);
    context.arc(xx, yy, 1.22, 0, 2 * Math.PI);
  }
  context.fill();

  context.fillStyle = palette.measured;
  context.globalAlpha = .42;
  const barWidth = plotWidth / BIN_COUNT;
  for (let index = 0; index < BIN_COUNT; index++) {
    const yy = y(sampleDensity(index));
    context.fillRect(left + index * barWidth, yy, Math.max(1, barWidth - .8), bottom - yy);
  }
  context.globalAlpha = 1;
  context.strokeStyle = palette.theory;
  context.lineWidth = 2.05;
  context.lineJoin = 'round';
  context.beginPath();
  const samples = Math.max(320, Math.ceil(plotWidth));
  for (let index = 0; index <= samples; index++) {
    const position = -HALF_SCREEN_MM + 2 * HALF_SCREEN_MM * index / samples;
    const yy = y(distribution.density(position));
    if (index === 0) context.moveTo(x(position), yy);
    else context.lineTo(x(position), yy);
  }
  context.stroke();
}

function announce(message) {
  get('announcement').textContent = message;
}

function resetHits() {
  count = 0;
  centralCount = 0;
  bins.fill(0);
  example = false;
}

function configure() {
  settings = {
    mode: document.querySelector('[name="mode"]:checked').value,
    wavelength: Number(wavelength.value),
    separation: Number(separation.value),
  };
  distribution = makeDistribution(settings);
  separation.disabled = settings.mode === 'single';
  get('wavelength-output').textContent = settings.wavelength.toFixed(2) + ' nm';
  get('separation-output').textContent = settings.separation.toFixed(2) + ' μm';
  get('mode-note').textContent = notes[settings.mode];
  resetHits();
  draw();
}

function syncRunButton() {
  run.textContent = running ? 'Pause beam' : 'Start beam';
}

function stop() {
  running = false;
  cancelAnimationFrame(animationFrame);
  syncRunButton();
}

function animate(time) {
  if (!running) return;
  previousFrame ??= time;
  credit += Math.min((time - previousFrame) / 1000, .1) * hitsPerSecond;
  previousFrame = time;
  const amount = Math.floor(credit);
  if (amount) {
    addHits(amount);
    credit -= amount;
    if (count === pointLimit) {
      stop();
      announce('Detector full. Clear hits to run again.');
    }
    draw();
  }
  if (running) animationFrame = requestAnimationFrame(animate);
}

run.addEventListener('click', () => {
  if (running) {
    stop();
    announce('Beam paused with ' + counter.format(count) + ' recorded hits.');
    return;
  }
  example = false;
  running = true;
  credit = 0;
  previousFrame = undefined;
  syncRunButton();
  announce('Beam running.');
  animationFrame = requestAnimationFrame(animate);
});

for (const [button, amount] of [[step, 1], [batch, 500]]) {
  button.addEventListener('click', () => {
    example = false;
    addHits(amount);
    if (count === pointLimit) stop();
    draw();
    announce(counter.format(count) + ' recorded hits.');
  });
}

get('clear').addEventListener('click', () => {
  stop();
  resetHits();
  draw();
  announce('Detector cleared.');
});

for (const control of document.querySelectorAll('[name="mode"], #wavelength, #separation')) {
  control.addEventListener('input', configure);
}

readColors();
configure();
let seed = 872913;
function sampleExample() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
example = true;
addHits(2350, sampleExample);
draw();
new ResizeObserver(draw).observe(canvas);
new MutationObserver(() => {
  readColors();
  draw();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
