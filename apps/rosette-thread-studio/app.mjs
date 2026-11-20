export const endpoints = (count, factor) => Array.from({length:count}, (_, i) => i*factor % count);

if (typeof document !== 'undefined') {
  const by = id => document.getElementById(id);
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  function paint() {
    const count = +by('points').value, factor = +by('factor').value;
    by('points-value').textContent = count;
    by('factor-value').textContent = factor;
    const center = [380,285], radius = 238;
    const ring = Array.from({length:count}, (_, i) => {
      const a = i/count * 2*Math.PI - Math.PI/2;
      return [center[0]+radius*Math.cos(a),center[1]+radius*Math.sin(a)];
    });
    const background = ctx.createRadialGradient(...center,16,...center,350);
    background.addColorStop(0,'#272545');
    background.addColorStop(1,'#151220');
    ctx.fillStyle = background;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#73608a';
    ctx.beginPath(); ctx.arc(...center,radius,0,2*Math.PI); ctx.stroke();
    let threads = 0;
    endpoints(count,factor).forEach((destination,i) => {
      if (i === destination) return;
      threads++;
      ctx.strokeStyle = 'hsla('+(180 + i/count*245)+', 93%, 72%, .58)';
      ctx.beginPath(); ctx.moveTo(...ring[i]); ctx.lineTo(...ring[destination]); ctx.stroke();
    });
    by('reading').textContent = threads + ' threads from ' + count + ' anchors';
  }
  by('settings').addEventListener('input',paint);
  by('png').addEventListener('click',() => {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png'); link.download = 'rosette.png'; link.click();
  });
  paint();
}
