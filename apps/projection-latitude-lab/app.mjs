const radians = degrees => degrees * Math.PI / 180;

export function distortion(latitude) {
  const cosine = Math.cos(radians(latitude));
  return {
    mercator: { horizontal: 1 / cosine, vertical: 1 / cosine, area: 1 / cosine ** 2 },
    equalArea: { horizontal: 1 / cosine, vertical: cosine, area: 1 },
  };
}

if (typeof document !== 'undefined') {
  const context = document.querySelector('canvas').getContext('2d');
  const latitude = document.querySelector('#latitude');
  const reading = document.querySelector('#reading');
  const mercatorY = degrees => Math.log(Math.tan(Math.PI / 4 + radians(degrees) / 2));
  const panels = [
    ['Mercator', 26, mercatorY, 'mercator', '#ddadfb'],
    ['Cylindrical equal-area', 400, degrees => Math.sin(radians(degrees)), 'equalArea', '#89e3cf'],
  ];

  function render() {
    const angle = Number(latitude.value);
    const scales = distortion(angle);
    const { width, height } = context.canvas;
    context.clearRect(0, 0, width, height);
    for (const [name, left, project, key, color] of panels) {
      const x = longitude => left + 165 + longitude / 180 * 155;
      const y = degrees => 214 - project(degrees) / project(82) * 140;
      context.fillStyle = '#241d32';
      context.fillRect(left, 56, 330, 318);
      context.fillStyle = color;
      context.font = 'bold 22px system-ui';
      context.fillText(name, left + 12, 38);
      context.strokeStyle = '#564567';
      context.lineWidth = 1;
      context.beginPath();
      for (let lat = -80; lat <= 80; lat += 20) {
        context.moveTo(x(-180), y(lat));
        context.lineTo(x(180), y(lat));
      }
      for (let lon = -180; lon <= 180; lon += 30) {
        context.moveTo(x(lon), y(82));
        context.lineTo(x(lon), y(-82));
      }
      context.stroke();
      context.strokeStyle = color;
      context.fillStyle = color + '53';
      context.lineWidth = 2.6;
      context.beginPath();
      context.moveTo(x(-180), y(angle));
      context.lineTo(x(180), y(angle));
      context.stroke();
      const scale = scales[key];
      context.beginPath();
      context.ellipse(x(0), y(angle), 12 * scale.horizontal, 12 * scale.vertical, 0, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
      context.fillStyle = '#e2d5ea';
      context.font = '18px system-ui';
      context.fillText(`Relative area ×${scale.area.toFixed(2)}`, left + 12, 403);
    }
    document.querySelector('#latitude-value').textContent = `${angle}°`;
    reading.textContent = `Area ×${scales.mercator.area.toFixed(2)} Mercator · ×1.00 equal-area`;
  }

  latitude.addEventListener('input', render);
  render();
}
