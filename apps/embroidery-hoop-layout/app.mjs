export function hoopLayout({ diameter, margin, width, height, columns, rows, gap }) {
  const totalWidth = width * columns + gap * (columns - 1);
  const totalHeight = height * rows + gap * (rows - 1);
  const usableRadius = diameter / 2 - margin;
  const clearance = usableRadius - Math.hypot(totalWidth / 2, totalHeight / 2);
  return { totalWidth, totalHeight, usableRadius, clearance, fits: clearance >= -1e-9 };
}

if (typeof document !== 'undefined') {
  const context = document.querySelector('canvas').getContext('2d');
  const settings = document.querySelector('#settings');
  const inputs = [...settings.querySelectorAll('input[type="range"]')];

  function render() {
    const options = Object.fromEntries(inputs.map(input => [input.id, Number(input.value)]));
    const { diameter, width, height, columns, rows, gap } = options;
    const layout = hoopLayout(options);
    const scale = 350 / Math.max(diameter, layout.totalWidth + 14, layout.totalHeight + 14);
    const cx = context.canvas.width / 2, cy = context.canvas.height / 2;
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    const ring = (radius, color, dashes) => {
      context.setLineDash(dashes);
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(cx, cy, radius * scale, 0, 2 * Math.PI);
      context.stroke();
    };
    ring(diameter / 2, '#edbee8', []);
    ring(layout.usableRadius, '#8d76ac', [7, 6]);
    context.setLineDash([]);
    const left = cx - layout.totalWidth * scale / 2, top = cy - layout.totalHeight * scale / 2;
    context.fillStyle = layout.fits ? '#8ce0c478' : '#ff899a80';
    context.strokeStyle = layout.fits ? '#a9e9d5' : '#ff9ba6';
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = left + column * (width + gap) * scale;
        const y = top + row * (height + gap) * scale;
        context.fillRect(x, y, width * scale, height * scale);
        context.strokeRect(x, y, width * scale, height * scale);
      }
    }
    for (const input of inputs) document.querySelector(`#${input.id}-value`).textContent = input.value;
    document.querySelector('#reading').textContent = layout.fits
      ? `Fits · ${layout.clearance.toFixed(1)} mm clearance`
      : `Exceeds stitch area by ${Math.abs(layout.clearance).toFixed(1)} mm`;
    document.querySelector('#footprint').textContent = `${layout.totalWidth} × ${layout.totalHeight} mm · ${rows * columns} motifs`;
  }

  settings.addEventListener('input', render);
  render();
}
