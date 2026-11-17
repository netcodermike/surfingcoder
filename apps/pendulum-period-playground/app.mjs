const gravity = 9.81;
const radians = Math.PI / 180;

export function periods(length, degrees) {
  const small = 2 * Math.PI * Math.sqrt(length / gravity);
  let a = 1, b = Math.cos(degrees * radians / 2);
  for (let i = 0; i < 12 && Math.abs(a - b) > 1e-13; i++) {
    [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  }
  return { small, full: small / a };
}

export function simulate(length, degrees, steps = 900) {
  const period = periods(length, degrees).full;
  const dt = period / steps;
  const accel = theta => -gravity / length * Math.sin(theta);
  let theta = degrees * radians, velocity = 0;
  const result = [theta];
  for (let i = 0; i < steps; i++) {
    const v1 = velocity, a1 = accel(theta);
    const v2 = velocity + a1 * dt / 2, a2 = accel(theta + v1 * dt / 2);
    const v3 = velocity + a2 * dt / 2, a3 = accel(theta + v2 * dt / 2);
    const v4 = velocity + a3 * dt, a4 = accel(theta + v3 * dt);
    theta += dt / 6 * (v1 + 2 * v2 + 2 * v3 + v4);
    velocity += dt / 6 * (a1 + 2 * a2 + 2 * a3 + a4);
    result.push(theta);
  }
  return result;
}

if (typeof document !== 'undefined') {
  const get = id => document.getElementById(id);
  const stage = document.querySelector('canvas'), ctx = stage.getContext('2d');
  const pivot = [stage.width / 2, 192], radius = 159;
  let cycle, period, frame, elapsed = 0, timestamp;
  function draw(index = 0) {
    const theta = cycle[index];
    ctx.clearRect(0, 0, stage.width, stage.height);
    ctx.beginPath();
    ctx.moveTo(...pivot);
    ctx.lineTo(pivot[0], pivot[1] + radius + 30);
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = '#9480aa';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(...pivot, radius, Math.PI / 2 - cycle[0], Math.PI / 2 + cycle[0]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8063a4';
    ctx.stroke();
    const bob = [pivot[0] + radius * Math.sin(theta), pivot[1] + radius * Math.cos(theta)];
    ctx.beginPath();
    ctx.moveTo(...pivot);
    ctx.lineTo(...bob);
    ctx.strokeStyle = '#e6bffa';
    ctx.lineWidth = 3;
    ctx.stroke();
    for (const [point, r, ink] of [[pivot, 7, '#dca4f3'], [bob, 16, '#ffd2a8']]) {
      ctx.beginPath(); ctx.arc(...point, r, 0, 2 * Math.PI); ctx.fillStyle = ink; ctx.fill();
    }
    ctx.font = '650 15px system-ui';
    ctx.fillStyle = '#dfc7ed';
    ctx.textAlign = 'center';
    ctx.fillText('Pivot', pivot[0], pivot[1] - 18);
    ctx.fillText((theta / radians).toFixed(1) + '°', bob[0], bob[1] + 34);
  }
  function pause() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    get('play').textContent = 'Play';
    get('play').setAttribute('aria-pressed', 'false');
  }
  function refresh() {
    const length = Number(get('length').value), angle = Number(get('angle').value);
    pause();
    elapsed = 0;
    const { full, small } = periods(length, angle);
    period = full;
    cycle = simulate(length, angle);
    get('length-value').textContent = length.toFixed(2) + ' m';
    get('angle-value').textContent = angle + '°';
    get('reading').textContent = 'Nonlinear period ' + full.toFixed(3) + ' s';
    get('compare').textContent = 'Small-angle estimate ' + small.toFixed(3) + ' s · ' + ((full / small - 1) * 100).toFixed(1) + '% longer';
    draw();
  }
  function tick(now) {
    if (timestamp === undefined) timestamp = now;
    elapsed = (elapsed + (now - timestamp) / 1000) % period;
    timestamp = now;
    draw(Math.floor(elapsed / period * (cycle.length - 1)));
    frame = requestAnimationFrame(tick);
  }
  get('play').addEventListener('click', () => {
    if (frame !== undefined) { pause(); return; }
    timestamp = undefined;
    get('play').textContent = 'Pause';
    get('play').setAttribute('aria-pressed', 'true');
    frame = requestAnimationFrame(tick);
  });
  get('reset-settings').addEventListener('click', () => { get('settings').reset(); refresh(); });
  get('settings').addEventListener('input', refresh);
  get('settings').addEventListener('submit', event => event.preventDefault());
  window.addEventListener('pagehide', pause);
  refresh();
}
