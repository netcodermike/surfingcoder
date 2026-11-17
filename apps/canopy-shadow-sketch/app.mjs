export function shadowOffset(height, elevation, azimuth) {
  const radians = Math.PI / 180;
  const distance = height / Math.tan(elevation * radians);
  return { distance, east: -distance * Math.sin(azimuth * radians), north: -distance * Math.cos(azimuth * radians) };
}

if (typeof document !== 'undefined') {
  const get = id => document.getElementById(id);
  const stage = document.querySelector('canvas'), ctx = stage.getContext('2d');
  const fields = ['width', 'depth', 'height', 'elevation', 'bearing'];
  const corners = (x, y, w, d) => [[x - w / 2, y - d / 2], [x + w / 2, y - d / 2], [x + w / 2, y + d / 2], [x - w / 2, y + d / 2]];
  function render() {
    const [width, depth, height, elevation, bearing] = fields.map(key => Number(get(key).value));
    fields.forEach((key, i) => { get(key + '-value').textContent = get(key).value + (i < 3 ? ' m' : '°'); });
    const { distance, east, north } = shadowOffset(height, elevation, bearing);
    const original = corners(0, 0, width, depth);
    const shifted = corners(east, north, width, depth);
    const scale = Math.min((stage.width - 128) / (width + Math.abs(east)), (stage.height - 105) / (depth + Math.abs(north)));
    const pixel = ([x, y]) => [stage.width / 2 + (x - east / 2) * scale, stage.height / 2 - (y - north / 2) * scale];
    ctx.clearRect(0, 0, stage.width, stage.height);
    ctx.strokeStyle = '#3b2d4f';
    ctx.lineWidth = 1;
    for (let x = 25; x < stage.width; x += 35) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, stage.height); ctx.stroke(); }
    for (let y = 25; y < stage.height; y += 35) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(stage.width, y); ctx.stroke(); }
    function polygon(points, stroke, fill, dashed = []) {
      ctx.beginPath();
      points.map(pixel).forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = stroke;
      ctx.setLineDash(dashed);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    polygon(shifted, '#caa1f9', '#b280e7a6');
    polygon(original, '#ffd59f', '#ffb47722', [6, 5]);
    ctx.beginPath();
    ctx.moveTo(...pixel([0, 0]));
    ctx.lineTo(...pixel([east, north]));
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#ffdfb7';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f4dcff';
    ctx.font = '700 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('↑ N', stage.width - 47, 37);
    get('reading').textContent = 'Shadow offset ' + distance.toFixed(2) + ' m';
    const fixed = value => (Math.abs(value) < .005 ? 0 : value).toFixed(2);
    get('offset').textContent = fixed(east) + ' m east · ' + fixed(north) + ' m north';
  }
  get('settings').addEventListener('input', render);
  get('settings').addEventListener('submit', event => event.preventDefault());
  get('reset-settings').addEventListener('click', () => { get('settings').reset(); render(); });
  render();
}
