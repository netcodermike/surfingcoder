export function aliasFrequency(signal, rate) {
  return Math.abs(signal - Math.round(signal/rate)*rate);
}

function initialize() {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const {width,height} = canvas;
  const tone = document.getElementById('tone');
  const rate = document.getElementById('rate');
  const plot = (source, color, dash=[]) => {
    ctx.beginPath();
    ctx.strokeStyle=color;
    ctx.lineWidth=2.4;
    ctx.setLineDash(dash);
    for(let i=0;i<=720;i++) {
      const fraction=i/720, x=24+fraction*(width-48), y=height/2-115*source(fraction);
      if(i===0)ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };
  function redraw() {
    const f=+tone.value, fs=+rate.value;
    const aliased=f-Math.round(f/fs)*fs;
    ctx.fillStyle='#231a30';
    ctx.fillRect(0,0,width,height);
    ctx.strokeStyle='#5a4967';
    for(let i=0;i<=8;i++){
      const x=24+i/8*(width-48);
      ctx.beginPath(); ctx.moveTo(x,38); ctx.lineTo(x,height-36); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(24,height/2); ctx.lineTo(width-24,height/2); ctx.stroke();
    plot(t=>Math.sin(2*Math.PI*f*t),'#ae80e9');
    plot(t=>Math.sin(2*Math.PI*aliased*t),'#70d6df',[8,5]);
    ctx.fillStyle='#ffc386';
    for(let i=0;i<=fs;i++) {
      const t=i/fs;
      ctx.beginPath();
      ctx.arc(24+t*(width-48),height/2-115*Math.sin(2*Math.PI*f*t),5,0,Math.PI*2);
      ctx.fill();
    }
    for (const [id,val] of [['tone',f],['rate',fs]]) document.getElementById(id+'-value').value=val+' Hz';
    document.getElementById('reading').textContent='Apparent frequency '+aliasFrequency(f,fs)+' Hz';
  }
  document.getElementById('settings').addEventListener('input',redraw);
  redraw();
}
if (typeof document !== 'undefined') initialize();
