const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function triangleCenters([a, b, c]) {
  const centroid = a.map((value, i) => (value + b[i] + c[i]) / 3);
  const u = b.map((value, i) => value - a[i]), v = c.map((value, i) => value - a[i]);
  const twiceCross = 2 * (u[0] * v[1] - u[1] * v[0]);
  if (Math.abs(twiceCross) < 1e-7) return { centroid, incenter: null, circumcenter: null, orthocenter: null };
  const uu = u[0] ** 2 + u[1] ** 2, vv = v[0] ** 2 + v[1] ** 2;
  const circumcenter = [a[0] + (uu * v[1] - vv * u[1]) / twiceCross, a[1] + (u[0] * vv - v[0] * uu) / twiceCross];
  const orthocenter = centroid.map((value, i) => 3 * value - 2 * circumcenter[i]);
  const lengths = [distance(b, c), distance(a, c), distance(a, b)];
  const perimeter = lengths.reduce((total, value) => total + value, 0);
  const incenter = a.map((value, i) => (lengths[0] * value + lengths[1] * b[i] + lengths[2] * c[i]) / perimeter);
  return { centroid, incenter, circumcenter, orthocenter, inradius: Math.abs(twiceCross) / (2 * perimeter), circumradius: distance(a, circumcenter) };
}

if (typeof document !== 'undefined') {
  const get = id => document.getElementById(id);
  const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
  const presets = { acute: [[150, 329], [393, 70], [620, 350]], right: [[155, 334], [155, 90], [603, 334]], obtuse: [[136, 340], [288, 200], [640, 345]] };
  const colors = { centroid: '#efcbff', incenter: '#a8e5d1', circumcenter: '#f4afbc', orthocenter: '#ffcf97' };
  let vertices = structuredClone(presets.acute), drag = false;
  function circle(point, radius, color, fill = false) {
    if (!point || radius > 3000) return;
    ctx.beginPath();
    ctx.arc(...point, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = ctx.fillStyle = color;
    if (fill) ctx.fill();
    else ctx.stroke();
  }
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centers = triangleCenters(vertices);
    ctx.lineWidth = 1.4;
    if (get('circles').checked) {
      circle(centers.circumcenter, centers.circumradius, '#f4afbc9c');
      circle(centers.incenter, centers.inradius, '#a8e5d196');
    }
    ctx.beginPath();
    vertices.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = '#9873be40';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c79de9';
    ctx.stroke();
    Object.entries(colors).forEach(([name, color], i) => {
      const point = centers[name];
      get(name).textContent = point ? point.map(n => Math.round(n)).join(', ') : 'Undefined';
      if (!point) return;
      circle(point, 7, color, true);
      ctx.fillStyle = color;
      ctx.font = '700 15px system-ui';
      ctx.fillText(['G', 'I', 'O', 'H'][i], point[0] + 10, point[1] - 5);
    });
    vertices.forEach((point, i) => {
      circle(point, 9, i === Number(get('vertex').value) ? '#ffd79e' : '#dd9ef6', true);
      ctx.fillStyle = '#e9c8f9';
      ctx.font = '700 15px system-ui';
      ctx.fillText('ABC'[i], Math.min(canvas.width - 18, point[0] + 13), point[1] + 5);
    });
    get('reading').textContent = centers.circumcenter ? 'Centers shown in canvas coordinates' : 'The vertices are collinear.';
  }
  function location(event) {
    const r = canvas.getBoundingClientRect();
    return [(event.clientX - r.left) * canvas.width / r.width, (event.clientY - r.top) * canvas.height / r.height];
  }
  function move(x, y) {
    vertices[Number(get('vertex').value)] = [Math.max(16, Math.min(canvas.width - 16, x)), Math.max(16, Math.min(canvas.height - 16, y))];
    render();
  }
  canvas.addEventListener('pointerdown', event => {
    const point = location(event);
    const hit = vertices.findIndex(p => distance(p, point) < 22);
    if (hit < 0) return;
    get('vertex').value = hit;
    drag = true;
    canvas.setPointerCapture(event.pointerId);
    render();
  });
  canvas.addEventListener('pointermove', event => { if (drag) move(...location(event)); });
  canvas.addEventListener('lostpointercapture', () => { drag = false; });
  canvas.addEventListener('keydown', event => {
    const step = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[event.key];
    if (!step) return;
    event.preventDefault();
    move(...vertices[Number(get('vertex').value)].map((value, index) => value + step[index]));
  });
  get('shape').addEventListener('change', () => { vertices = structuredClone(presets[get('shape').value]); render(); });
  get('vertex').addEventListener('change', render);
  get('circles').addEventListener('change', render);
  render();
}
