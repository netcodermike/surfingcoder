export function fringeSpacing(pitch, angle) {
  const separation = 2 * Math.abs(Math.sin(angle * Math.PI / 360));
  return separation < 1e-9 ? Infinity : pitch / separation;
}

function initialize() {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const angleInput = document.getElementById('angle');
  const pitchInput = document.getElementById('pitch');
  const {width, height} = canvas;
  function redraw() {
    const angle = +angleInput.value, pitch = +pitchInput.value;
    const spacing = fringeSpacing(pitch, angle);
    ctx.fillStyle = '#211830';
    ctx.fillRect(0, 0, width, height);
    for (const [rotation, hue] of [[-angle/2, '#d6a0e6c9'], [angle/2, '#89f2d9a3']]) {
      ctx.save();
      ctx.translate(width/2, height/2);
      ctx.rotate(rotation*Math.PI/180);
      ctx.strokeStyle = hue;
      ctx.lineWidth = Math.max(2, pitch*0.3);
      ctx.beginPath();
      for (let x = -width; x <= width; x += pitch) {
        ctx.moveTo(x,-width);
        ctx.lineTo(x,width);
      }
      ctx.stroke();
      ctx.restore();
    }
    document.getElementById('angle-value').value = angle + '°';
    document.getElementById('pitch-value').value = pitch + ' px';
    document.getElementById('reading').textContent = Number.isFinite(spacing)
      ? 'Fringe spacing ' + spacing.toFixed(1) + ' px'
      : 'Parallel screens · no finite fringe spacing';
  }
  document.getElementById('settings').addEventListener('input', redraw);
  redraw();
}
if (typeof document !== 'undefined') initialize();
