(() => {
  'use strict';

  const canvas = document.querySelector('#reef-display');
  const play = document.querySelector('#reef-play');
  const reset = document.querySelector('#reef-reset');
  const sound = document.querySelector('#reef-sound');
  const status = document.querySelector('#reef-status');
  const controls = [...document.querySelectorAll('.reef-controller [data-button]')];
  const context = canvas.getContext('2d');
  const pixels = context?.createImageData(canvas.width, canvas.height);

  const keys = {
    ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
    z: 'A', a: 'A', Enter: 'START',
  };
  const held = new Map();
  const frameInterval = 1000 / 60.0988;
  const pressInterval = 40;
  const sampleRate = 48000;
  const blockSize = 2048;
  const audioSamples = [new Float32Array(blockSize), new Float32Array(blockSize)];
  const audioOutputs = new Set();
  const Audio = window.AudioContext ?? window.webkitAudioContext;

  let nes, loading = false;
  let frameRequest = 0, previousFrame, pendingTime = 0;
  let audio, volume, audioCursor = 0, audioEnd = 0, soundEnabled = Boolean(Audio);

  function showStatus(message) {
    status.textContent = message;
  }

  function showControls(running) {
    play.hidden = running;
    play.disabled = false;
    reset.disabled = !running;
    for (const control of controls) control.disabled = !running;
  }

  function updateSoundButton() {
    sound.textContent = Audio ? (soundEnabled ? 'Sound on' : 'Sound off') : 'Sound unavailable';
    sound.setAttribute('aria-pressed', String(soundEnabled));
    sound.disabled = !Audio;
  }

  function startAudio() {
    if (!soundEnabled) return;
    try {
      if (!audio) {
        audio = new Audio();
        volume = audio.createGain();
        volume.gain.value = .54;
        volume.connect(audio.destination);
      }
      audio.resume().catch(() => {
        showStatus('Play is available. Toggle sound to retry audio.');
      });
    } catch {
      soundEnabled = false;
      updateSoundButton();
    }
  }

  function clearAudio() {
    for (const output of audioOutputs) output.stop();
    audioOutputs.clear();
    audioCursor = 0;
    audioEnd = 0;
  }

  function queueAudio(left, right) {
    if (!soundEnabled || audio?.state !== 'running') return;
    audioSamples[0][audioCursor] = left;
    audioSamples[1][audioCursor] = right;
    if (++audioCursor < blockSize) return;
    audioCursor = 0;

    const now = audio.currentTime;
    // Keep the queued audio short so a slow tab never builds a long playback delay.
    if (audioEnd - now > .16) return;
    if (audioEnd < now) audioEnd = now + .035;
    const buffer = audio.createBuffer(2, blockSize, sampleRate);
    buffer.copyToChannel(audioSamples[0], 0);
    buffer.copyToChannel(audioSamples[1], 1);
    const output = audio.createBufferSource();
    output.buffer = buffer;
    output.connect(volume);
    output.addEventListener('ended', () => audioOutputs.delete(output), { once: true });
    output.start(audioEnd);
    audioOutputs.add(output);
    audioEnd += buffer.duration;
  }

  function drawFrame(frameBuffer) {
    // The JSNES frame buffer stores red in the low byte, as in its browser renderer.
    for (let i = 0; i < frameBuffer.length; i++) {
      const offset = 4 * i;
      const color = frameBuffer[i];
      pixels.data[offset] = color & 255;
      pixels.data[offset + 1] = color >> 8 & 255;
      pixels.data[offset + 2] = color >> 16 & 255;
      pixels.data[offset + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
  }

  function buttonHeld(button) {
    return [...held.values()].some(input => input.button === button);
  }

  function updatePad(button, active) {
    controls.find(control => control.dataset.button === button)?.classList.toggle('is-held', active);
  }

  function press(source, button) {
    if (!nes || held.has(source)) return;
    if (!buttonHeld(button)) {
      nes.buttonDown(1, globalThis.jsnes.Controller['BUTTON_' + button]);
      updatePad(button, true);
      if (button === 'START') showStatus('');
    }
    held.set(source, { button, since: performance.now(), timer: 0 });
  }

  function release(source, briefly = false) {
    const input = held.get(source);
    if (!input) return;
    const remaining = pressInterval - (performance.now() - input.since);
    if (briefly && remaining > 0) {
      if (!input.timer) input.timer = setTimeout(() => release(source), remaining);
      return;
    }
    clearTimeout(input.timer);
    held.delete(source);
    if (!buttonHeld(input.button)) {
      nes?.buttonUp(1, globalThis.jsnes.Controller['BUTTON_' + input.button]);
      updatePad(input.button, false);
    }
  }

  function suspendFrames() {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    previousFrame = undefined;
    pendingTime = 0;
    for (const source of held.keys()) release(source);
    clearAudio();
  }

  function gameError(error) {
    suspendFrames();
    nes = undefined;
    showControls(false);
    showStatus(error.message || 'Reef Runner could not start.');
  }

  function tick(now) {
    frameRequest = 0;
    if (!nes || document.hidden) return;
    pendingTime += previousFrame === undefined ? frameInterval : Math.min(80, now - previousFrame);
    previousFrame = now;
    try {
      while (pendingTime >= frameInterval) {
        nes.frame();
        pendingTime -= frameInterval;
      }
    } catch (error) {
      gameError(error);
      return;
    }
    frameRequest = requestAnimationFrame(tick);
  }

  function resumeFrames() {
    if (nes && !document.hidden && !frameRequest) frameRequest = requestAnimationFrame(tick);
  }

  function begin() {
    showControls(true);
    showStatus('Press Start or Enter to paddle out.');
    canvas.focus({ preventScroll: true });
    resumeFrames();
  }

  play.addEventListener('click', async () => {
    if (loading || nes) return;
    loading = true;
    play.disabled = true;
    showStatus('Loading the Reef Runner cartridge…');
    startAudio();
    try {
      if (!globalThis.jsnes?.NES || !pixels) throw Error('The game display could not start.');
      if (location.protocol === 'file:') throw Error('Open Reef Runner through a local web server to load the cartridge.');
      const response = await fetch('./reef-runner.nes');
      if (!response.ok) throw Error('The Reef Runner cartridge could not be loaded.');
      const cartridge = await response.arrayBuffer();
      const emulator = new globalThis.jsnes.NES({ onFrame: drawFrame, onAudioSample: queueAudio, sampleRate });
      emulator.loadROM(cartridge);
      nes = emulator;
      begin();
    } catch (error) {
      gameError(error);
    } finally {
      loading = false;
    }
  });

  reset.addEventListener('click', () => {
    if (!nes) return;
    suspendFrames();
    startAudio();
    try {
      nes.reloadROM();
      begin();
    } catch (error) {
      gameError(error);
    }
  });

  sound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (!soundEnabled) clearAudio();
    else if (nes || loading) startAudio();
    updateSoundButton();
  });
  updateSoundButton();

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  canvas.addEventListener('keydown', event => {
    const key = keyName(event);
    if (!nes || !Object.hasOwn(keys, key) || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    if (!event.repeat) press('key:' + key, keys[key]);
  });
  window.addEventListener('keyup', event => release('key:' + keyName(event), true));

  for (const control of controls) {
    const button = control.dataset.button;
    control.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !nes) return;
      event.preventDefault();
      control.setPointerCapture(event.pointerId);
      press(event.pointerId, button);
    });
    control.addEventListener('pointerup', event => release(event.pointerId, true));
    control.addEventListener('pointercancel', event => release(event.pointerId));
    control.addEventListener('lostpointercapture', event => release(event.pointerId, true));
    control.addEventListener('click', event => {
      if (event.detail !== 0) return;
      const source = 'activate:' + button;
      press(source, button);
      release(source, true);
    });
  }

  window.addEventListener('blur', () => {
    for (const source of held.keys()) release(source);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) suspendFrames();
    else resumeFrames();
  });
  window.addEventListener('pagehide', suspendFrames);
  window.addEventListener('pageshow', resumeFrames);
})();
