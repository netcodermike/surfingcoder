export function envelope(attack, decay, sustain, hold, release) {
  const turn = attack + decay;
  return [[0, 0], [attack, 1], [turn, sustain], [turn + hold, sustain], [turn + hold + release, 0]];
}

if (typeof document !== 'undefined') {
  const get = id => document.getElementById(id);
  const display = document.querySelector('canvas');
  const draw = display.getContext('2d');
  const ids = ['attack', 'decay', 'sustain', 'hold', 'release'];
  const phases = ['Attack', 'Decay', 'Hold', 'Release'];
  const colors = ['#af79e9', '#d398f3', '#f1b3d6', '#f6b995'];
  let audio, active;
  function points() {
    return envelope(...ids.map(id => Number(get(id).value)));
  }
  function redraw() {
    const data = points();
    const total = data.at(-1)[0];
    const floor = display.height - 50;
    const coords = data.map(([time, level]) => [58 + time / total * (display.width - 106), floor - level * (floor - 58)]);
    draw.clearRect(0, 0, display.width, display.height);
    draw.font = '600 14px system-ui';
    for (const level of [0, .25, .5, .75, 1]) {
      const y = floor - level * (floor - 58);
      draw.fillStyle = '#c2b1d1';
      draw.fillText(String(level), 17, y + 5);
      draw.fillStyle = '#4b3b60';
      draw.fillRect(56, y, display.width - 104, 1);
    }
    phases.forEach((phase, index) => {
      const [[x1, y1], [x2, y2]] = coords.slice(index, index + 2);
      draw.beginPath();
      draw.moveTo(x1, floor);
      draw.lineTo(x1, y1);
      draw.lineTo(x2, y2);
      draw.lineTo(x2, floor);
      draw.closePath();
      draw.fillStyle = colors[index] + '40';
      draw.fill();
      draw.beginPath();
      draw.moveTo(x1, y1);
      draw.lineTo(x2, y2);
      draw.strokeStyle = colors[index];
      draw.lineWidth = 4;
      draw.stroke();
      if (x2 - x1 >= 70) {
        draw.fillStyle = '#e5d8ec';
        draw.fillText(phase, (x1 + x2) / 2 - draw.measureText(phase).width / 2, floor + 27);
      }
    });
    for (const id of ids) {
      const value = Number(get(id).value);
      get(id + '-value').textContent = id === 'sustain' ? Math.round(value * 100) + '%' : value.toFixed(2) + ' s';
    }
    get('reading').textContent = 'Envelope length ' + total.toFixed(2) + ' seconds';
  }
  get('settings').addEventListener('input', redraw);
  get('settings').addEventListener('submit', event => event.preventDefault());
  get('stop').addEventListener('click', () => {
    if (active) active.stop();
    active = null;
    get('stop').disabled = true;
  });
  get('play').addEventListener('click', async () => {
    if (active) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) { get('reading').textContent = 'This browser cannot play Web Audio.'; return; }
    const play = get('play');
    play.disabled = true;
    try {
      audio ??= new Audio();
      await audio.resume();
      const tone = audio.createOscillator(), gain = audio.createGain(), data = points();
      const start = audio.currentTime + .04;
      tone.type = get('waveform').value;
      tone.frequency.value = Number(get('pitch').value);
      gain.gain.setValueAtTime(0, start);
      for (const [time, level] of data.slice(1)) gain.gain.linearRampToValueAtTime(level * .21, start + time);
      tone.connect(gain).connect(audio.destination);
      tone.onended = () => {
        tone.disconnect();
        gain.disconnect();
        if (tone === active) active = null;
        get('stop').disabled = !active;
        play.disabled = Boolean(active);
      };
      active = tone;
      get('stop').disabled = false;
      tone.start(start);
      tone.stop(start + data.at(-1)[0] + .03);
    } catch {
      get('reading').textContent = 'Audio could not start in this tab.';
      play.disabled = false;
    }
  });
  window.addEventListener('pagehide', () => { if (active) active.stop(); });
  redraw();
}
