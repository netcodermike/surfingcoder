export function echoes(delay, feedback) {
  const result = [];
  for (let index = 0; index < 14; index++) {
    const gain = feedback ** index;
    if (gain < .02) break;
    result.push({time:index*delay, gain});
  }
  return result;
}

function initialize() {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const {width,height} = canvas;
  const delay = document.getElementById('delay');
  const feedback = document.getElementById('feedback');
  const play = document.getElementById('listen');
  const values = () => echoes(+delay.value/1000, +feedback.value/100);
  function redraw() {
    const marks=values();
    ctx.fillStyle='#241a30'; ctx.fillRect(0,0,width,height);
    const left=38, base=height-54, w=width-76, duration=Math.max(.5,marks.at(-1).time);
    ctx.font='18px system-ui';
    ctx.strokeStyle='#594665';
    for(let i=0;i<=4;i++){
      const x=left+w*i/4;
      ctx.beginPath();ctx.moveTo(x,28);ctx.lineTo(x,base);ctx.stroke();
      ctx.fillStyle='#cab7d7';ctx.fillText((duration*i/4).toFixed(1)+' s',x-17,base+25);
    }
    marks.forEach(({time,gain},index)=>{
      const x=left+time/duration*w, y=base-gain*220;
      ctx.strokeStyle=index?'#ee9cbc':'#82e5d3';
      ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,base);ctx.lineTo(x,y);ctx.stroke();
      ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(x,y,5,0,2*Math.PI);ctx.fill();
    });
    document.getElementById('delay-value').value=delay.value+' ms';
    document.getElementById('feedback-value').value=feedback.value+'%';
    document.getElementById('reading').textContent=(marks.length-1)+' audible echoes';
  }
  let audio;
  play.addEventListener('click',async ()=>{
    const marks=values();
    play.disabled=true;
    try {
      audio ??= new AudioContext();
      await audio.resume();
      const start=audio.currentTime+.04;
      for(const {time,gain} of marks){
        const sample=audio.createOscillator(), envelope=audio.createGain(), when=start+time;
        sample.frequency.setValueAtTime(480,when);
        sample.frequency.exponentialRampToValueAtTime(120,when+.06);
        envelope.gain.setValueAtTime(gain*.24,when);
        envelope.gain.exponentialRampToValueAtTime(.001,when+.07);
        sample.connect(envelope).connect(audio.destination);
        sample.start(when);
        sample.stop(when+.08);
      }
      setTimeout(()=>{play.disabled=false;},(marks.at(-1).time+.2)*1000);
    } catch(error) {
      play.disabled=false;
      document.getElementById('reading').textContent=error.message;
    }
  });
  document.getElementById('settings').addEventListener('input',redraw);
  redraw();
}
if (typeof document !== 'undefined') initialize();
