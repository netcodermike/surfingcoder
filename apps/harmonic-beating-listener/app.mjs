export const beatRate = (first,second) => Math.abs(first-second);
export const envelope = (first,second,t) => Math.abs(Math.cos(Math.PI*beatRate(first,second)*t));

function initialize() {
  const canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d');
  const get=id=>document.getElementById(id);
  const {width,height}=canvas;
  const extent=1.25, left=40, span=width-78, center=height/2;
  function redraw() {
    const first=+get('first').value, second=+get('second').value;
    for(const [key,value] of [['first',first],['second',second]]) get(key+'-value').value=value+' Hz';
    get('reading').textContent='Beat rate '+beatRate(first,second)+' Hz';
    ctx.fillStyle='#17162a';ctx.fillRect(0,0,width,height);
    ctx.font='16px system-ui';
    for(let i=0;i<=5;i++) {
      const x=left+i/5*span;
      ctx.strokeStyle='#463650';ctx.beginPath();ctx.moveTo(x,29);ctx.lineTo(x,height-46);ctx.stroke();
      ctx.fillStyle='#d3c4d9';ctx.fillText((extent*i/5).toFixed(2)+' s',x-19,height-18);
    }
    ctx.strokeStyle='#e3b8ff';ctx.beginPath();
    for(let i=0;i<=250;i++){
      const t=extent*i/250, amp=118*envelope(first,second,t);
      const x=left+i/250*span;
      ctx.moveTo(x,center-amp);ctx.lineTo(x,center+amp);
    }
    ctx.globalAlpha=.32;ctx.stroke();ctx.globalAlpha=1;
    const fn=t=>118*envelope(first,second,t);
    ctx.strokeStyle='#78e3cb';ctx.lineWidth=2.2;
    for(const sign of [-1,1]){
      ctx.beginPath();
      for(let i=0;i<=480;i++){
        const x=left+i/480*span,y=center+sign*fn(i/480*extent);
        if(i===0)ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
  }
  let audio;
  const play=get('listen');
  play.addEventListener('click',async()=>{
    play.disabled=true;
    try{
      audio??=new AudioContext();
      await audio.resume();
      const time=audio.currentTime, end=time+3;
      const gain=audio.createGain();
      gain.gain.setValueAtTime(0,time);
      gain.gain.linearRampToValueAtTime(.08,time+.06);
      gain.gain.setValueAtTime(.08,end-.06);
      gain.gain.linearRampToValueAtTime(0,end);
      gain.connect(audio.destination);
      for(const id of ['first','second']){
        const tone=audio.createOscillator();
        tone.frequency.value=+get(id).value;
        tone.connect(gain);tone.start(time);tone.stop(end);
      }
      setTimeout(()=>{gain.disconnect();play.disabled=false;},3100);
    }catch(error){
      play.disabled=false;get('reading').textContent=error.message;
    }
  });
  get('settings').addEventListener('input',redraw);
  redraw();
}
if (typeof document !== 'undefined') initialize();
