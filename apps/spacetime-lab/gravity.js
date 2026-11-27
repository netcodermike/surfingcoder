import { earthClocks } from './physics.js?v=1';
import { makePlot, svgNode } from './plot.js?v=1';

const maxAltitude = 40_000;
const presets = {
  mountain: { altitude: 4, orbit: false },
  leo: { altitude: 400, orbit: true },
  gps: { altitude: 20_200, orbit: true },
};
const series = [
  { key: 'gravityUsPerDay', color: 'var(--warm)', width: 2.5 },
  { key: 'motionUsPerDay', color: 'var(--earth)', width: 2.5, dash: '7 5' },
  { key: 'netUsPerDay', color: 'var(--ship)', width: 3.5 },
];
const formatAltitude = new Intl.NumberFormat('en-US');

function signedRate(value) {
  const magnitude = Math.abs(value);
  if (magnitude === 0) return '0 μs/day';
  const precision = magnitude >= 1 ? 2 : 4;
  return `${value > 0 ? '+' : '−'}${magnitude.toFixed(precision)} μs/day`;
}

export function initGravity() {
  const panel = document.getElementById('gravity-panel');
  const get = id => panel.querySelector('#' + id);
  const svg = get('gravity-diagram');
  const range = get('gravity-altitude-range');
  const number = get('gravity-altitude');
  const orbit = get('gravity-orbit');
  const buttons = [...panel.querySelectorAll('[data-gravity-preset]')];
  let altitude = Number(range.value);

  function draw() {
    const current = earthClocks(altitude, orbit.checked);
    const altitudeText = formatAltitude.format(altitude) + ' km';
    range.setAttribute('aria-valuetext', altitudeText);
    get('gravity-altitude-summary').textContent = altitudeText;
    get('gravity-gain').textContent = signedRate(current.gravityUsPerDay);
    get('gravity-loss').textContent = signedRate(current.motionUsPerDay);
    get('gravity-net').textContent = signedRate(current.netUsPerDay);
    get('gravity-speed').textContent = orbit.checked ? current.speedKmPerS.toFixed(2) + ' km/s' : 'Stationary clock';
    get('gravity-motion-key').hidden = !orbit.checked;
    get('gravity-net-key').hidden = !orbit.checked;
    buttons.forEach(button => {
      const preset = presets[button.dataset.gravityPreset];
      button.setAttribute('aria-pressed', String(altitude === preset.altitude && orbit.checked === preset.orbit));
    });

    get('gravity-chart-note').textContent = orbit.checked
      ? 'A net gain begins above about 3,186 km in this idealized model.'
      : 'A stationary clock at higher altitude gains time relative to the surface clock.';
    svg.setAttribute('aria-label', `Clock-rate differences by altitude. At ${altitudeText}, the net difference is ${signedRate(current.netUsPerDay)}.`);
    const plot = makePlot(svg, {
      xMin: 0, xMax: maxAltitude, yMin: orbit.checked ? -40 : 0, yMax: 60,
      xLabel: 'Altitude (km)', yLabel: 'Clock difference (μs/day)',
      xTicks: [0, 10_000, 20_000, 30_000, 40_000],
      yTicks: orbit.checked ? [-40, -20, 0, 20, 40, 60] : [0, 15, 30, 45, 60],
    });
    const samples = Array.from({ length: 81 }, (_, i) => {
      const height = i * maxAltitude / 80;
      return { height, ...earthClocks(height, orbit.checked) };
    });
    plot.layer.append(
      svgNode('line', { x1: plot.x(0), x2: plot.x(maxAltitude), y1: plot.y(0), y2: plot.y(0), stroke: 'var(--muted)' }),
      svgNode('line', { x1: plot.x(altitude), x2: plot.x(altitude), y1: plot.y(orbit.checked ? -40 : 0), y2: plot.y(60),
        stroke: 'var(--muted)', 'stroke-dasharray': '4 5' }),
    );
    const visibleSeries = orbit.checked ? series : series.slice(0, 1);
    for (const { key, color, width, dash } of visibleSeries) {
      const path = samples.map(({ height, [key]: value }, i) => `${i ? 'L' : 'M'} ${plot.x(height)} ${plot.y(value)}`).join(' ');
      const style = dash ? { 'stroke-dasharray': dash } : {};
      plot.layer.append(svgNode('path', {
        d: path, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none', ...style,
      }));
    }
    for (const { key, color } of visibleSeries) {
      plot.layer.append(svgNode('circle', {
        cx: plot.x(altitude), cy: plot.y(current[key]), r: 5, fill: color, stroke: 'var(--ink)', 'stroke-width': 1,
      }));
    }
  }

  function setAltitude(value) {
    altitude = value;
    range.value = value;
    number.value = value;
    draw();
  }

  range.addEventListener('input', () => setAltitude(range.valueAsNumber));
  number.addEventListener('input', () => {
    if (number.validity.valid) {
      altitude = number.valueAsNumber;
      range.value = altitude;
      draw();
    }
  });
  number.addEventListener('change', () => {
    if (!number.validity.valid) number.value = altitude;
  });
  orbit.addEventListener('change', draw);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const preset = presets[button.dataset.gravityPreset];
      orbit.checked = preset.orbit;
      setAltitude(preset.altitude);
    });
  }
  draw();
  return { draw };
}
