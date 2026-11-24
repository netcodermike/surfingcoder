function gcd(a, b) { while (b) [a,b] = [b,a % b]; return a; }

export function geometry(ring, gear, offset) {
  if (!Number.isInteger(ring) || !Number.isInteger(gear) || ring > 144 || gear < 1 ||
      ring <= gear || !Number.isFinite(offset) || offset < 0 || offset > 1)
    throw Error('Choose a smaller gear than the ring and a pen offset from 0 to 100%');
  const turns = offset === 0 ? 1 : gear / gcd(ring, gear);
  const frequency = (ring - gear) / gear;
  function point(t) {
    return [(ring-gear)*Math.cos(t) + gear*offset*Math.cos(frequency*t),
            (ring-gear)*Math.sin(t) - gear*offset*Math.sin(frequency*t)];
  }
  return {turns, point, steps: Math.max(360, Math.ceil(160 * turns * Math.max(1,frequency)))};
}

if (typeof document !== 'undefined') {
  const find = id => document.getElementById(id);
  const ctx = find('drawing').getContext('2d');
  function draw() {
    const ring = Number(find('ring').value), gear = Number(find('gear').value);
    const offset = Number(find('offset').value), pct = Number(find('progress').value);
    find('ringValue').textContent = ring;
    find('gearValue').textContent = gear;
    find('offsetValue').textContent = offset + '%';
    find('progressValue').textContent = pct + '%';
    let model;
    try { model = geometry(ring, gear, offset/100); find('error').textContent = ''; }
    catch (error) { find('error').textContent = error.message; return; }
    const {width, height} = ctx.canvas;
    const scale = (height * 0.445) / ring;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = '#121a24'; ctx.fillRect(0,0,width,height);
    ctx.setTransform(scale,0,0,-scale,width/2,height/2);
    function circle(x,y,r,color) {
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
      ctx.lineWidth = 1.5/scale; ctx.strokeStyle = color; ctx.stroke();
    }
    circle(0,0,ring,'#687e91');
    const end = 2*Math.PI*model.turns*pct/100;
    const segments = Math.max(1,Math.ceil(model.steps*pct/100));
    const gradient = ctx.createLinearGradient(-ring, -ring, ring, ring);
    gradient.addColorStop(0,'#57e3cd'); gradient.addColorStop(0.5,'#9daefb'); gradient.addColorStop(1,'#ffc296');
    ctx.beginPath();
    for (let i=0; i<=segments; i++) {
      const [x,y] = model.point(end*i/segments);
      if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.lineWidth=2/scale; ctx.strokeStyle=gradient; ctx.stroke();
    const cx=(ring-gear)*Math.cos(end), cy=(ring-gear)*Math.sin(end);
    const [px,py]=model.point(end);
    if (find('guide').checked) {
      circle(cx,cy,gear,'#94a5b8');
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(px,py); ctx.stroke();
      ctx.beginPath(); ctx.arc(px,py,4/scale,0,2*Math.PI); ctx.fillStyle='#ffd598'; ctx.fill();
    }
    find('reading').textContent = 'Closes after ' + model.turns + (model.turns === 1 ? ' orbit' : ' orbits') + ' of the gear center';
  }
  for (const id of ['ring','gear','offset','progress','guide']) find(id).addEventListener('input',draw);
  find('example').addEventListener('change', () => {
    const [ring, gear, offset] = find('example').value.split(',');
    find('ring').value = ring; find('gear').value = gear; find('offset').value = offset; find('progress').value=100; draw();
  });
  draw();
}
