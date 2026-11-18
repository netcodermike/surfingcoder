export function foldedFrequency(tone, rate) {
  return tone - rate * Math.round(tone / rate);
}

if (typeof document !== 'undefined') {
  const context = document.querySelector('canvas').getContext('2d');
  const tone = document.querySelector('#tone');
  const rate = document.querySelector('#rate');
  const listen = document.querySelector('#listen');
  let audio;

  function render() {
    const frequency = Number(tone.value), samplesPerSecond = Number(rate.value);
    const alias = foldedFrequency(frequency, samplesPerSecond);
    const { width, height } = context.canvas;
    const left = 42, right = width - 24, midpoint = height / 2 - 12;
    const limit = .035;
    const x = time => left + (right - left) * time / limit;
    const y = amplitude => midpoint - amplitude * 124;
    const signal = (hz, time) => Math.sin(2 * Math.PI * hz * time + Math.PI / 6);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#cfc0dc';
    context.font = '17px system-ui';
    context.strokeStyle = '#4f425f';
    context.lineWidth = 1;
    for (let mark = 0; mark <= 35; mark += 5) {
      context.beginPath(); context.moveTo(x(mark / 1000), 40); context.lineTo(x(mark / 1000), height - 60); context.stroke();
      context.fillText(`${mark} ms`, x(mark / 1000) - 22, height - 24);
    }
    context.beginPath(); context.moveTo(left, midpoint); context.lineTo(right, midpoint); context.stroke();
    for (const [hz, color] of [[frequency, '#b894f2'], [alias, '#6fe5cb']]) {
      context.strokeStyle = color;
      context.lineWidth = 2.8;
      context.beginPath();
      for (let px = left; px <= right; px++) {
        const time = limit * (px - left) / (right - left);
        if (px === left) context.moveTo(px, y(signal(hz, time)));
        else context.lineTo(px, y(signal(hz, time)));
      }
      context.stroke();
    }
    context.fillStyle = '#ffd189';
    for (let sample = 0; sample / samplesPerSecond <= limit; sample++) {
      const time = sample / samplesPerSecond;
      context.beginPath(); context.arc(x(time), y(signal(frequency, time)), 5, 0, 2 * Math.PI); context.fill();
    }
    document.querySelector('#tone-value').textContent = `${frequency} Hz`;
    document.querySelector('#rate-value').textContent = `${samplesPerSecond} Hz`;
    document.querySelector('#reading').textContent = `Apparent tone ${Math.abs(alias)} Hz · Nyquist limit ${samplesPerSecond / 2} Hz`;
    document.querySelector('#trace-key').textContent = 'Purple · input tone   |   Mint · reconstruction   |   Gold · samples';
    listen.disabled = !alias || !window.AudioContext;
    listen.title = alias ? '' : 'Zero-frequency reconstruction has no audible pitch';
  }

  listen.addEventListener('click', async () => {
    audio ??= new AudioContext();
    await audio.resume();
    const frequency = Math.abs(foldedFrequency(Number(tone.value), Number(rate.value)));
    if (!frequency) return;
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    const now = audio.currentTime;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(.1, now + .03);
    envelope.gain.linearRampToValueAtTime(0, now + .45);
    oscillator.connect(envelope).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + .46);
  });
  document.querySelector('#settings').addEventListener('input', render);
  render();
}
