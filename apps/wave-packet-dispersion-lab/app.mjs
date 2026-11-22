export function velocities(k, dispersion) {
  return { phase: dispersion * k, group: 2 * dispersion * k };
}

export function sample(x, time, k, dispersion) {
  const { group } = velocities(k, dispersion);
  const displacement = x - group * time;
  const envelope = Math.exp(-0.5 * (displacement / 2.6) ** 2);
  return { envelope, signal: envelope * Math.cos(k*x - dispersion*k*k*time) };
}

function initialize() {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const {width,height} = canvas;
  const kInput = document.getElementById('frequency');
  const dInput = document.getElementById('dispersion');
  const timeInput = document.getElementById('elapsed');
  const button = document.getElementById('play');
  const color = { signal:'#b786f3', envelope:'#64e0cf', ground:'#16172b', grid:'#41354e' };
  let frame = 0, origin = 0;
  function redraw() {
    const k = +kInput.value, d = +dInput.value, t = +timeInput.value;
    const settings = { frequency:k.toFixed(1), dispersion:d.toFixed(2), elapsed:t.toFixed(1)+' s' };
    for (const [key,value] of Object.entries(settings)) document.getElementById(key+'-value').value=value;
    const speeds = velocities(k,d);
    document.getElementById('reading').textContent='Group '+speeds.group.toFixed(2)+' · Phase '+speeds.phase.toFixed(2)+' units/s';
    const left=38, right=width-34, zero=height/2;
    const xpos = x => left + (x + 10) / 34 * (right-left);
    ctx.fillStyle=color.ground;ctx.fillRect(0,0,width,height);
    ctx.font='16px system-ui';
    for(let x=-8;x<=24;x+=4) {
      ctx.strokeStyle=color.grid;ctx.beginPath();ctx.moveTo(xpos(x),34);ctx.lineTo(xpos(x),height-42);ctx.stroke();
      ctx.fillStyle='#bdb1cb';ctx.fillText(String(x),xpos(x)-9,height-17);
    }
    ctx.beginPath();ctx.moveTo(left,zero);ctx.lineTo(right,zero);ctx.stroke();
    for(const [key,sign] of [['envelope',1],['envelope',-1],['signal',1]]) {
      ctx.strokeStyle=color[key];ctx.lineWidth=key==='signal'?3:1.6;
      ctx.setLineDash(key==='envelope'?[6,5]:[]);
      ctx.beginPath();
      for(let i=0;i<=720;i++){
        const x=-10+i/720*34;
        const y=zero-126*sample(x,t,k,d)[key]*sign;
        if(i===0)ctx.moveTo(xpos(x),y);
        else ctx.lineTo(xpos(x),y);
      }
      ctx.stroke();ctx.setLineDash([]);
    }
  }
  function animate(now) {
    if(!origin)origin=now-(+timeInput.value)*1000;
    timeInput.value=((now-origin)/1000)%5;
    redraw();
    frame=requestAnimationFrame(animate);
  }
  button.addEventListener('click',()=>{
    if(frame){cancelAnimationFrame(frame);frame=0;button.textContent='Play';}
    else{origin=0;frame=requestAnimationFrame(animate);button.textContent='Pause';}
  });
  document.getElementById('settings').addEventListener('input',()=>{origin=0;redraw();});
  redraw();
}
if (typeof document !== 'undefined') initialize();
