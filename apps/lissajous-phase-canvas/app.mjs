export function point(xRate, yRate, phase, t) {
  return { x: Math.sin(xRate*t+phase*Math.PI/180), y: Math.sin(yRate*t) };
}

function initialize() {
  const canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d');
  const get=id=>document.getElementById(id);
  const {width,height}=canvas;
  function redraw() {
    const xRate=+get('x-rate').value, yRate=+get('y-rate').value, phase=+get('phase').value;
    get('x-rate-value').value=xRate;
    get('y-rate-value').value=yRate;
    get('phase-value').value=phase+'°';
    get('reading').textContent=xRate+' × '+yRate+' · '+phase+'° phase';
    const fill=ctx.createRadialGradient(width/2,height/2,15,width/2,height/2,width*.6);
    fill.addColorStop(0,'#221e3a');fill.addColorStop(1,'#11111e');
    ctx.fillStyle=fill;ctx.fillRect(0,0,width,height);
    ctx.strokeStyle='#4f3c68';ctx.lineWidth=1;ctx.beginPath();
    ctx.moveTo(32,height/2);ctx.lineTo(width-32,height/2);
    ctx.moveTo(width/2,32);ctx.lineTo(width/2,height-32);ctx.stroke();
    let previous=point(xRate,yRate,phase,0);
    ctx.lineWidth=3;
    ctx.lineCap='round';
    for(let i=1;i<=980;i++){
      const next=point(xRate,yRate,phase,i/980*2*Math.PI);
      ctx.strokeStyle='hsl('+(178+145*i/980)+' 86% 73%)';
      ctx.beginPath();
      ctx.moveTo(width/2+previous.x*(width*.42),height/2-previous.y*(height*.39));
      ctx.lineTo(width/2+next.x*(width*.42),height/2-next.y*(height*.39));
      ctx.stroke();
      previous=next;
    }
  }
  get('settings').addEventListener('input',redraw);
  get('save').addEventListener('click',()=>{
    const anchor=document.createElement('a');
    anchor.href=canvas.toDataURL('image/png');
    anchor.download='lissajous-phase.png';
    anchor.click();
  });
  redraw();
}
if (typeof document !== 'undefined') initialize();
