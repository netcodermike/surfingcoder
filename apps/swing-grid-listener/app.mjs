export function grid(tempo, swing, beats) {
  const length = 60/tempo;
  return Array.from({length:beats*2}, (_,i) => (Math.floor(i/2) + (i%2 ? swing/100 : 0))*length);
}

if (typeof document !== 'undefined') {
  const by = id => document.getElementById(id);
  const ctx = document.querySelector('canvas').getContext('2d');
  function paint() {
    const bpm = +by('tempo').value, swing = +by('swing').value;
    by('tempo-value').textContent = bpm;
    by('swing-value').textContent = swing + '%';
    by('reading').textContent = 'Offbeat delay ' + Math.round((swing/100-.5)*60000/bpm) + ' ms';
    ctx.fillStyle = '#191428';
    ctx.fillRect(0,0,760,368);
    ctx.font = '18px system-ui'; ctx.textAlign = 'left';
    ctx.fillStyle = '#e8d7f5';
    ctx.fillText('Straight eighths',44,65); ctx.fillText('Swung eighths',44,195);
    const x = beat => 48 + beat*82;
    for (let beat=0;beat<=8;beat++) {
      ctx.strokeStyle = beat%4===0 ? '#7d6294' : '#493b58';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x(beat),82); ctx.lineTo(x(beat),293); ctx.stroke();
      if (beat<8) ctx.fillText(String(beat%4+1),x(beat)-5,322);
    }
    for (const [y,amount] of [[116,50],[247,swing]]) {
      grid(bpm,amount,8).forEach((second,index) => {
        const left = x(second*bpm/60);
        ctx.fillStyle = index%2 ? '#f5c77f' : '#a991f2';
        ctx.fillRect(left-4,y-(index%2 ? 10 : 17),8,index%2 ? 24 : 40);
      });
    }
  }

  let audio;
  let playback;
  async function play() {
    if (playback) return;
    const button = by('listen');
    button.disabled = true;
    playback = true;
    try {
      audio ??= new AudioContext();
      await audio.resume();
      const tempo = +by('tempo').value, swing = +by('swing').value;
      const start = audio.currentTime + .05;
      const section = 8*60/tempo;
      [swing,50].forEach((amount, part) => grid(tempo,amount,8).forEach((offset,i) => {
        const when = start + part*section + offset;
        const click = audio.createOscillator(), gain = audio.createGain();
        click.frequency.value = i%8===0 ? 1050 : i%2 ? 590 : 810;
        gain.gain.setValueAtTime(i%2 ? .07 : .12, when);
        gain.gain.exponentialRampToValueAtTime(.001,when+.055);
        click.connect(gain).connect(audio.destination);
        click.start(when); click.stop(when+.06);
      }));
      setTimeout(() => { playback = false; button.disabled = false; }, 1000*(2*section+.13));
    } catch (error) {
      by('reading').textContent = 'Could not start audio: ' + error.message;
      playback = false;
      button.disabled = false;
    }
  }
  by('listen').addEventListener('click',play);
  by('settings').addEventListener('input',paint);
  paint();
}
