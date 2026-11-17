import { createBasin, depthAt, estimates, normalizeSettings, PRESETS } from './model.mjs';

const element = id => document.getElementById(id);
const form = element('settings');
const section = element('section');
const chart = element('chart');
const traceColors = ['#83ece0', '#cc9cf9'];
const sampleRate = 10;
let currentSettings = PRESETS['Gentle beach'];
let comparisonSettings = null;
let runs, duration, time, sampleIndex, frame, previousFrame;
let range;

function readSettings() {
  return normalizeSettings(Object.fromEntries(new FormData(form)));
}

function setFields(settings) {
  for (const [name, value] of Object.entries(settings)) form.elements.namedItem(name).value = value;
}

function runTime(settings) {
  const endToEnd = estimates({ ...settings, gauge: 100 }).timeToGauge;
  const transit = settings.boundary === 'wall' ? 2 * endToEnd : endToEnd;
  return settings.period * settings.cycles + transit + settings.period;
}

function restart() {
  stop(false);
  time = sampleIndex = 0;
  range = { low: 0, high: 0, observedFraction: 0 };
  runs = [currentSettings, comparisonSettings].filter(Boolean).map(settings => ({
    basin: createBasin(settings),
    trace: [0],
  }));
  duration = Math.ceil(Math.max(...runs.map(({ basin }) => runTime(basin.settings))) / 10) * 10;
  const stats = estimates(currentSettings);
  element('celerity').textContent = stats.speed.toFixed(2) + ' m/s';
  element('slope').textContent = Number.isFinite(stats.slope) ? stats.slope.toFixed(1) + ':1' : 'Flat';
  element('arrival').textContent = stats.timeToGauge.toFixed(1) + ' s';
  element('gauge-info').textContent = stats.gaugeRange.toFixed(1) + ' m from inlet · ' + stats.gaugeDepth.toFixed(2) + ' m still-water depth';
  element('baseline-key').hidden = element('clear-baseline').hidden = !comparisonSettings;
  element('download').disabled = true;
  updateLimits();
  render();
}

function updateLimits() {
  const { relativeDepth, gaugeDepth } = estimates(currentSettings);
  const warnings = [];
  if (relativeDepth > .05) warnings.push('At the inlet, depth exceeds about 1/20 of the estimated wavelength. Dispersion can matter.');
  if (currentSettings.amplitude / gaugeDepth > .15 || range.observedFraction > .15) warnings.push('Wave amplitude is large relative to local depth. The linear model becomes less reliable.');
  const text = warnings.join(' ') || 'Small waves and long wavelengths suit this model.';
  const warning = element('warning');
  if (warning.textContent !== text) warning.textContent = text;
  warning.classList.toggle('flagged', Boolean(warnings.length));
}

function context(canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.font = '11px system-ui';
  return { ctx, w, h };
}

function line(ctx, points, color, width = 1, dash = []) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function fill(ctx, points, color) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.fillStyle = color;
  ctx.fill();
}

function plotSection() {
  const { ctx, w, h } = context(section);
  const { settings, eta, cells } = runs[0].basin;
  const left = 42, right = w - 13, top = 30, bottom = h - 28;
  const datum = top + (bottom - top) * .32;
  const scale = (bottom - datum - 4) / settings.depth;
  const x = fraction => left + fraction * (right - left);
  const maxSurface = Math.max(.001, ...eta.map(Math.abs));
  const troughRatio = Math.max(.001, ...eta.map((height, i) => -height / depthAt(settings, (i + .5) / cells * settings.length)));
  const zoom = Math.min(5, .9 / troughRatio, (datum - top - 4) / (scale * Math.max(maxSurface, settings.amplitude)));
  const surface = Array.from(eta, (height, i) => [x((i + .5) / cells), datum - height * scale * zoom]);
  surface.unshift([left, surface[0][1]]);
  surface.push([right, surface.at(-1)[1]]);
  const bed = [
    [left, datum + settings.depth * scale], [x(settings.beachStart / 100), datum + settings.depth * scale],
    [right, datum + settings.endDepth * scale],
  ];

  const water = ctx.createLinearGradient(0, top, 0, bottom);
  water.addColorStop(0, '#347c87');
  water.addColorStop(.6, '#26425f');
  water.addColorStop(1, '#252044');
  fill(ctx, [[left, bottom], ...bed, [right, bottom]], '#4a334e');
  fill(ctx, [...surface, ...[...bed].reverse()], water);

  const ticks = w < 420 ? 4 : 8;
  ctx.fillStyle = '#ab9aba';
  ctx.textAlign = 'center';
  for (let i = 0; i <= ticks; i++) {
    const px = x(i / ticks);
    line(ctx, [[px, top], [px, bottom]], '#5a4d6e55');
    ctx.fillText((i * settings.length / ticks).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' m', px, h - 9);
  }
  ctx.textAlign = 'right';
  ctx.fillText('0 m', left - 5, datum + 4);
  ctx.fillText('−' + settings.depth.toFixed(1), left - 5, datum + settings.depth * scale + 4);
  line(ctx, [[left, datum], [right, datum]], '#bba7d06e', 1, [4, 4]);
  line(ctx, bed, '#b98dc8', 2);
  line(ctx, surface, traceColors[0], 2.2);
  const gauge = x(settings.gauge / 100);
  line(ctx, [[gauge, top], [gauge, bottom]], '#ffc99c', 1, [3, 4]);
  ctx.beginPath();
  ctx.arc(gauge, datum - runs[0].basin.at(settings.gauge / 100) * scale * zoom, 4, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffc99c';
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f0d5fc';
  ctx.fillText('Wavemaker', left, 20);
  ctx.textAlign = settings.gauge > 78 ? 'right' : 'center';
  ctx.fillStyle = '#ffc99c';
  ctx.fillText('Gauge', gauge, 20);
  if (settings.boundary === 'wall') line(ctx, [[right, top], [right, bottom]], '#b98dc8', 3);
  element('magnification').textContent = zoom.toFixed(1) + '× surface scale';
}

function plotHistory() {
  const { ctx, w, h } = context(chart);
  const left = 49, right = w - 17, top = 14, bottom = h - 26;
  const initialScale = Math.max(.05, ...runs.map(({ basin }) => basin.settings.amplitude * 1.25));
  const limit = Math.ceil(20 * Math.max(initialScale, ...runs.map(({ trace }) => Math.max(...trace.map(Math.abs))))) / 20;
  const x = seconds => left + seconds / duration * (right - left);
  const y = level => top + (limit - level) / (2 * limit) * (bottom - top);
  const ticks = w < 450 ? 3 : 6;
  ctx.fillStyle = '#af9fbd';
  ctx.textAlign = 'right';
  for (const level of [limit, limit / 2, 0, -limit / 2, -limit]) {
    const py = y(level);
    line(ctx, [[left, py], [right, py]], level ? '#3c304e' : '#6f5a84');
    ctx.fillText((level * 100).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' cm', left - 6, py + 4);
  }
  ctx.textAlign = 'center';
  for (let i = 0; i <= ticks; i++) {
    const seconds = Math.round(i * duration / ticks);
    line(ctx, [[x(seconds), top], [x(seconds), bottom]], '#3c304e');
    ctx.fillText(seconds + ' s', x(seconds), h - 8);
  }
  if (runs.length === 2) line(ctx, runs[1].trace.map((value, i) => [x(i / sampleRate), y(value)]), traceColors[1], 1.7, [5, 3]);
  line(ctx, runs[0].trace.map((value, i) => [x(i / sampleRate), y(value)]), traceColors[0], 2);
}

function render() {
  plotSection();
  plotHistory();
  element('range').textContent = sampleIndex ? ((range.high - range.low) * 100).toFixed(1) + ' cm' : '—';
  element('elapsed').textContent = time.toFixed(1) + ' / ' + duration + ' s';
}

function advance(target) {
  while ((sampleIndex + 1) / sampleRate <= target) {
    const sampleTime = ++sampleIndex / sampleRate;
    runs.forEach(({ basin, trace }) => {
      basin.advanceTo(sampleTime);
      trace.push(basin.at(basin.settings.gauge / 100));
    });
    const [{ basin, trace }] = runs;
    range.high = Math.max(range.high, trace.at(-1));
    range.low = Math.min(range.low, trace.at(-1));
    for (let i = 0; i < basin.cells; i++) {
      const depth = depthAt(basin.settings, (i + .5) * basin.dx);
      range.observedFraction = Math.max(range.observedFraction, Math.abs(basin.eta[i]) / depth);
    }
  }
  runs.forEach(({ basin }) => basin.advanceTo(target));
  time = target;
  element('download').disabled = !sampleIndex;
  updateLimits();
}

function tick(timestamp) {
  const step = previousFrame ? Math.min(.07, (timestamp - previousFrame) / 1000) * Number(element('rate').value) : 0;
  previousFrame = timestamp;
  advance(Math.min(duration, time + step));
  render();
  if (time >= duration) stop();
  else frame = requestAnimationFrame(tick);
}

function stop(announce = true) {
  if (frame) cancelAnimationFrame(frame);
  frame = previousFrame = 0;
  element('play').textContent = time >= duration ? 'Replay' : 'Play';
  if (announce) element('announcement').textContent = 'Paused at ' + time.toFixed(1) + ' seconds. Gauge range ' + element('range').textContent + '.';
}

element('play').onclick = () => {
  if (frame) { stop(); return; }
  if (time >= duration) restart();
  element('play').textContent = 'Pause';
  frame = requestAnimationFrame(tick);
};
element('reset').onclick = () => { restart(); element('announcement').textContent = 'Simulation reset.'; };
element('baseline').onclick = () => {
  comparisonSettings = { ...currentSettings };
  element('comparison-note').textContent = 'Comparison saved. Apply a new design, then play both runs together.';
  restart();
};
element('clear-baseline').onclick = () => {
  comparisonSettings = null;
  element('comparison-note').textContent = 'Save this design, then change settings to compare both gauge traces.';
  restart();
};
form.onsubmit = event => {
  event.preventDefault();
  currentSettings = readSettings();
  setFields(currentSettings);
  restart();
  element('announcement').textContent = 'Basin settings applied.';
};
for (const [name, settings] of Object.entries(PRESETS)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = name;
  button.onclick = () => { setFields(settings); form.requestSubmit(); };
  element('presets').append(button);
}
element('download').onclick = () => {
  const [current, baseline] = runs;
  const header = 'time_s,current_elevation_m,current_gauge_m' + (baseline ? ',comparison_elevation_m,comparison_gauge_m' : '');
  const gauge = ({ basin }) => (basin.settings.length * basin.settings.gauge / 100).toFixed(3);
  const rows = current.trace.map((elevation, i) => [
    (i / sampleRate).toFixed(1), elevation.toFixed(6), gauge(current),
    ...(baseline ? [baseline.trace[i].toFixed(6), gauge(baseline)] : []),
  ].join(','));
  const url = URL.createObjectURL(new Blob([[header, ...rows].join('\n') + '\n'], { type: 'text/csv' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'wave-pool-gauge.csv';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

setFields(currentSettings);
restart();
new ResizeObserver(render).observe(section);
