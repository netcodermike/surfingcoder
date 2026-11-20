export function transmitted(input, angle) {
  return input * Math.cos(angle * Math.PI / 180) ** 2;
}

if (typeof document !== 'undefined') {
  const by = id => document.getElementById(id);
  const ctx = document.querySelector('canvas').getContext('2d');
  const angle = by('angle'), incoming = by('incoming');
  function paint() {
    const a = +angle.value, start = +incoming.value, result = transmitted(start, a);
    by('angle-value').textContent = a + '°';
    by('incoming-value').textContent = start + '%';
    by('reading').textContent = result.toFixed(1) + '% transmitted';
    ctx.fillStyle = '#191428';
    ctx.fillRect(0, 0, 760, 410);
    for (const [x, radians, label] of [[190,0,'Incident polarization'],[570,a*Math.PI/180,'Filter axis']]) {
      ctx.strokeStyle = '#695775';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, 90, 43, 0, 2*Math.PI); ctx.stroke();
      ctx.strokeStyle = x < 300 ? '#fbcb8b' : '#ca9afa';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x - 33*Math.sin(radians),90 + 33*Math.cos(radians));
      ctx.lineTo(x + 33*Math.sin(radians),90 - 33*Math.cos(radians));
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = '17px system-ui';
      ctx.fillStyle = '#ead7f7';
      ctx.fillText(label,x,158);
    }
    const x = v => 77 + v*3.45, y = v => 346 - v*1.45;
    ctx.font = '15px system-ui';
    for (const level of [0,25,50,75,100]) {
      ctx.strokeStyle = '#40344d'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x(0),y(level)); ctx.lineTo(x(180),y(level)); ctx.stroke();
      ctx.fillStyle = '#d1bedc'; ctx.fillText(level+'%',45,y(level)+4);
    }
    for (const value of [0,45,90,135,180]) ctx.fillText(value+'°',x(value),373);
    ctx.strokeStyle = '#92dbc9'; ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i=0;i<=180;i++) ctx.lineTo(x(i),y(transmitted(start,i)));
    ctx.stroke();
    ctx.fillStyle = '#ffd18f';
    ctx.beginPath(); ctx.arc(x(a), y(result), 6, 0, 2*Math.PI); ctx.fill();
  }
  by('settings').addEventListener('input', paint);
  paint();
}
