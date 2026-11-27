import { trip, tripAt } from './physics.js?v=1';
import { makePlot, svgNode } from './plot.js?v=1';
import { initEvents } from './events.js?v=1';
import { initGravity } from './gravity.js?v=1';

const byId = id => document.getElementById(id);
const years = value => value.toFixed(2) + ' yr';
const presets = { nearby: [4, .8], fast: [4, .99], long: [20, .95] };

function initTrip() {
  const distance = byId('trip-distance'), speed = byId('trip-speed'), preset = byId('trip-preset');
  const slider = byId('trip-time'), chart = byId('trip-chart'), play = byId('trip-play');
  const shipFrame = byId('show-ship-frame'), frameText = byId('trip-frame-text');
  let route = trip(4, .8), fraction = 1, plot, markers, frame, previous;

  function line(className, x1, y1, x2, y2) {
    return svgNode('line', { class: className, x1: plot.x(x1), y1: plot.y(y1), x2: plot.x(x2), y2: plot.y(y2) });
  }

  function draw() {
    const { distance, legYears, earthYears } = route;
    plot = makePlot(chart, { xMin: -distance * .4, xMax: distance * 1.4, yMin: -.06 * earthYears,
      yMax: 1.1 * earthYears, xLabel: 'Position (light-years)', yLabel: 'Earth-frame time (years)', equalUnits: true });
    const lightEnd = plot.yMax;
    const turnX = plot.x(distance), turnY = plot.y(legYears);
    const labelOnLeft = plot.x(plot.xMax) - turnX < 88;
    const worldlines = [
      line('light-path', 0, 0, lightEnd, lightEnd),
      line('light-path', 0, 0, -lightEnd, lightEnd),
      line('earth-path', 0, 0, 0, earthYears),
      svgNode('path', { class: 'ship-path', d: `M ${plot.x(0)} ${plot.y(0)} L ${plot.x(distance)} ${plot.y(legYears)} L ${plot.x(0)} ${plot.y(earthYears)}` }),
      svgNode('circle', { class: 'turn-dot', cx: turnX, cy: turnY, r: 5 }),
      svgNode('text', { class: 'turn-label', x: turnX + (labelOnLeft ? -10 : 10), y: turnY - 9,
        'text-anchor': labelOnLeft ? 'end' : 'start' }, 'Turnaround'),
    ];
    markers = {
      now: line('now-path', plot.xMin, 0, plot.xMax, 0),
      simultaneous: line('frame-path', plot.xMin, 0, plot.xMax, 0),
      remoteClock: svgNode('circle', { class: 'frame-dot', r: 4 }),
      earth: svgNode('circle', { class: 'earth-dot', r: 7, cx: plot.x(0) }),
      ship: svgNode('circle', { class: 'ship-dot', r: 5 }),
    };
    plot.layer.append(...worldlines, ...Object.values(markers));
    updateTime();
  }

  function updateTime() {
    const earthTime = route.earthYears * fraction;
    const { position, shipTime, velocity, returning, simultaneousEarthTime } = tripAt(route.distance, route.speed, earthTime);
    byId('earth-clock').textContent = years(earthTime);
    byId('ship-clock').textContent = years(shipTime);
    byId('age-gap').textContent = years(earthTime - shipTime);
    byId('trip-phase').textContent = fraction === 1 ? 'Reunited on Earth'
      : fraction === 0 ? 'At launch' : fraction === .5 ? 'At turnaround' : returning ? 'Returning' : 'Outbound';
    const timeline = `${earthTime.toFixed(2)} of ${route.earthYears.toFixed(2)} Earth yr`;
    slider.value = Math.round(fraction * 1000);
    slider.setAttribute('aria-valuetext', timeline);
    byId('trip-time-label').textContent = timeline;
    const currentY = plot.y(earthTime);
    markers.now.setAttribute('y1', currentY);
    markers.now.setAttribute('y2', currentY);
    markers.earth.setAttribute('cy', currentY);
    markers.ship.setAttribute('cx', plot.x(position));
    markers.ship.setAttribute('cy', currentY);
    const frameVisibility = shipFrame.checked ? 'visible' : 'hidden';
    markers.simultaneous.setAttribute('visibility', frameVisibility);
    markers.remoteClock.setAttribute('visibility', frameVisibility);
    frameText.hidden = !shipFrame.checked;
    byId('frame-key').hidden = !shipFrame.checked;
    if (shipFrame.checked) {
      markers.simultaneous.setAttribute('y1', plot.y(earthTime + velocity * (plot.xMin - position)));
      markers.simultaneous.setAttribute('y2', plot.y(earthTime + velocity * (plot.xMax - position)));
      markers.remoteClock.setAttribute('cx', plot.x(0));
      markers.remoteClock.setAttribute('cy', plot.y(simultaneousEarthTime));
      frameText.textContent = `In the ship’s current rest frame, Earth’s clock reads ${years(simultaneousEarthTime)} at this moment.`;
    }
  }

  function stop() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    previous = undefined;
    play.textContent = 'Play journey';
  }

  function advance(now) {
    if (previous !== undefined) fraction = Math.min(1, fraction + (now - previous) / 10000);
    previous = now;
    updateTime();
    if (fraction === 1) stop();
    else frame = requestAnimationFrame(advance);
  }

  function updateRoute() {
    stop();
    route = trip(distance.valueAsNumber, speed.valueAsNumber);
    const velocity = route.speed.toFixed(3) + 'c';
    byId('trip-speed-text').textContent = velocity;
    speed.setAttribute('aria-valuetext', velocity);
    const gamma = route.gamma.toFixed(3);
    byId('trip-math').textContent = `γ = ${gamma} · ${years(route.earthYears)} / ${gamma} = ${years(route.shipYears)}`;
    const meetsGoal = route.earthYears >= 100 && route.shipYears <= 10;
    const challenge = byId('trip-challenge');
    challenge.dataset.success = String(meetsGoal);
    challenge.textContent = (meetsGoal ? 'Both targets met.' : 'Try another route.') +
      ` Earth ${years(route.earthYears)} · ship ${years(route.shipYears)}`;
    draw();
  }

  preset.addEventListener('change', () => {
    if (preset.value === 'custom') return;
    [distance.value, speed.value] = presets[preset.value];
    fraction = 1;
    updateRoute();
  });
  for (const input of [distance, speed]) {
    input.addEventListener('input', () => {
      if (!Number.isFinite(distance.valueAsNumber) || !distance.validity.valid) return;
      preset.value = 'custom';
      updateRoute();
    });
  }
  distance.addEventListener('blur', () => {
    if (!distance.validity.valid || !Number.isFinite(distance.valueAsNumber)) distance.value = route.distance;
  });
  slider.addEventListener('input', () => {
    stop();
    fraction = slider.valueAsNumber / 1000;
    updateTime();
  });
  shipFrame.addEventListener('change', updateTime);
  play.addEventListener('click', () => {
    if (frame !== undefined) {
      stop();
      return;
    }
    if (fraction === 1) fraction = 0;
    updateTime();
    play.textContent = 'Pause journey';
    frame = requestAnimationFrame(advance);
  });
  byId('trip-restart').addEventListener('click', () => {
    stop();
    fraction = 0;
    updateTime();
  });
  updateRoute();
  return { draw, stop };
}

const tabs = [...document.querySelectorAll('.lab-tabs [role="tab"]')];
const modes = [initTrip(), initEvents(), initGravity()];
let active = 0;

function showTab(index) {
  modes[active].stop?.();
  active = index;
  tabs.forEach((tab, i) => {
    const selected = i === index;
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;
    byId(tab.getAttribute('aria-controls')).hidden = !selected;
  });
  modes[index].draw();
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => showTab(index));
  tab.addEventListener('keydown', event => {
    const target = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0, End: tabs.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    showTab(target);
    tabs[target].focus();
  });
});

let resizeFrame;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => modes[active].draw());
});
