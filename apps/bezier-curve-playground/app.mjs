export const mix = (a, b, t) => a.map((value, index) => value + (b[index] - value) * t);
export function construction([a, b, c], t) {
  const left = mix(a, b, t), right = mix(b, c, t);
  return { left, right, point: mix(left, right, t) };
}

if (typeof document !== 'undefined') {
  const plot = document.querySelector('canvas');
  const context = plot.getContext('2d');
  const progress = document.querySelector('#progress');
  const handle = document.querySelector('#handle');
  const output = document.querySelector('#reading');
  const defaults = [[125, 324], [390, 52], [634, 294]];
  let controls = structuredClone(defaults);
  let dragging = false;
  const { width, height } = plot;
  function line(points, color, thickness, dashed = []) {
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = thickness;
    context.setLineDash(dashed);
    points.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
    context.stroke();
    context.setLineDash([]);
  }
  function dot(point, color, size) {
    context.beginPath();
    context.arc(...point, size, 0, 2 * Math.PI);
    context.fillStyle = color;
    context.fill();
  }
  function redraw() {
    const t = Number(progress.value) / 100;
    const { left, right, point } = construction(controls, t);
    context.clearRect(0, 0, width, height);
    for (let x = 20; x < width; x += 35) line([[x, 0], [x, height]], '#2e2541', 1);
    for (let y = 20; y < height; y += 35) line([[0, y], [width, y]], '#2e2541', 1);
    line(controls, '#817294', 2, [8, 7]);
    const curve = Array.from({ length: 101 }, (_, i) => construction(controls, i / 100).point);
    line(curve, '#efccff', 4);
    line([left, right], '#feb88f', 3);
    for (const midpoint of [left, right]) dot(midpoint, '#feb88f', 6);
    controls.forEach((p, i) => {
      dot(p, i === Number(handle.value) ? '#ffe19d' : '#b47bed', 11);
      context.fillStyle = '#f8eaff';
      context.font = '700 15px system-ui';
      context.fillText(['Start', 'Control', 'End'][i], Math.min(p[0] + 14, width - 62), p[1] + 6);
    });
    dot(point, '#ffdfad', 9);
    output.textContent = 't = ' + t.toFixed(2) + ' · Point (' + point.map(n => n.toFixed(1)).join(', ') + ')';
  }
  function pointerPosition(event) {
    const screen = plot.getBoundingClientRect();
    return [(event.clientX - screen.left) * width / screen.width, (event.clientY - screen.top) * height / screen.height];
  }
  function move([x, y]) {
    controls[Number(handle.value)] = [Math.max(13, Math.min(width - 13, x)), Math.max(13, Math.min(height - 13, y))];
    redraw();
  }
  plot.addEventListener('pointerdown', event => {
    const anchor = pointerPosition(event);
    const index = controls.findIndex(point => Math.hypot(point[0] - anchor[0], point[1] - anchor[1]) <= 26);
    if (index < 0) return;
    handle.value = index;
    dragging = true;
    plot.setPointerCapture(event.pointerId);
    redraw();
  });
  plot.addEventListener('pointermove', event => { if (dragging) move(pointerPosition(event)); });
  plot.addEventListener('lostpointercapture', () => { dragging = false; });
  plot.addEventListener('keydown', event => {
    const shift = { ArrowUp: [0, -8], ArrowDown: [0, 8], ArrowLeft: [-8, 0], ArrowRight: [8, 0] }[event.key];
    if (!shift) return;
    event.preventDefault();
    move(controls[Number(handle.value)].map((value, index) => value + shift[index]));
  });
  progress.addEventListener('input', redraw);
  handle.addEventListener('change', redraw);
  document.querySelector('#reset').addEventListener('click', () => {
    controls = structuredClone(defaults);
    progress.value = 45;
    handle.value = 1;
    redraw();
  });
  redraw();
}
