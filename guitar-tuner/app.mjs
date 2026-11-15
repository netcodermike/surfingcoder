import { frequency, noteName } from './music.mjs';
import { estimatePitch, pitchReading } from './pitch.mjs';
import { instruments } from './presets.mjs';
import { playSound, stopSound, wakeAudio } from './synth.mjs';

const $ = id => document.getElementById(id);
const instrument = $('instrument');
const preset = $('preset');
const mode = $('mode');
const reference = $('reference');
let locked = null;
let stream;
let source;
let analyser;
let frame;
let request = 0;
let starting = false;
let quietUntil = 0;
let lastReading = null;
const recent = [];

const current = () => instruments[instrument.selectedIndex];
const tuning = () => current().tunings[preset.selectedIndex];
const a4 = () => reference.valueAsNumber >= 415 && reference.valueAsNumber <= 466 ? reference.valueAsNumber : 440;

function showReading(hz) {
  const lockedMidi = locked === null ? null : tuning().notes[locked];
  const reading = hz && pitchReading(hz, mode.value === 'preset' ? tuning().notes : [], lockedMidi, a4());
  const target = reading ? (mode.value === 'preset' ? tuning().spellings[locked ?? tuning().notes.indexOf(reading.midi)] : noteName(reading.midi))
    : lockedMidi === null ? '—' : tuning().spellings[locked];
  $('reading-note').textContent = target;
  $('reading-hz').textContent = reading ? `${hz.toFixed(2)} Hz · detected ${noteName(reading.detected)}`
    : lockedMidi === null ? 'Play one string at a time' : `Target ${frequency(lockedMidi, a4()).toFixed(2)} Hz`;
  const needle = $('needle');
  needle.hidden = !reading;
  const state = $('tuning-state');
  const centered = reading && Math.abs(reading.cents) <= 4;
  $('meter-heading').closest('.gt-meter').classList.toggle('gt-centered', Boolean(centered));
  if (reading) {
    needle.style.left = `${Math.min(100, Math.max(0, 50 + reading.cents))}%`;
    const cents = Math.round(reading.cents);
    state.textContent = `${centered ? 'In tune' : reading.cents < 0 ? 'Tune up' : 'Tune down'} · ${cents > 0 ? '+' : ''}${cents}¢`;
  } else {
    state.textContent = stream ? 'Listening for a steady note' : 'Waiting for a note';
  }
}

function renderTargets() {
  const config = tuning();
  const targets = $('targets');
  function targetButton(index, label) {
    const button = document.createElement('button');
    const string = document.createElement('span');
    const pitch = document.createElement('strong');
    button.type = 'button';
    button.dataset.index = index;
    button.setAttribute('aria-pressed', String(index === locked));
    string.textContent = label;
    pitch.textContent = config.spellings[index];
    button.append(string, pitch);
    button.addEventListener('click', () => {
      locked = index;
      mode.value = 'preset';
      renderTargets();
      targets.querySelector(`[data-index="${index}"]`).focus();
      playReference();
    });
    return button;
  }
  targets.toggleAttribute('data-paired', current().paired);
  if (current().paired) {
    targets.replaceChildren(...Array.from({ length: 6 }, (_, course) => {
      const group = document.createElement('div');
      const title = document.createElement('span');
      const index = course * 2;
      const octaves = config.notes[index] !== config.notes[index + 1];
      title.textContent = `Course ${6 - course}`;
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', title.textContent);
      group.append(title, targetButton(index, octaves ? 'Low' : 'First'),
        targetButton(index + 1, octaves ? 'Octave' : 'Second'));
      return group;
    }));
  } else {
    targets.replaceChildren(...config.notes.map((_, index) =>
      targetButton(index, `${current().unit} ${config.notes.length - index}`)));
  }
  $('auto').setAttribute('aria-pressed', String(locked === null));
  $('reference-tone').disabled = locked === null;
  const detail = locked === null ? 'Choose a string to lock its target and hear its pitch.'
    : `${config.spellings[locked]} locked at ${frequency(config.notes[locked], a4()).toFixed(2)} Hz.`;
  $('target-detail').textContent = detail;
  showReading(lastReading);
}

function resetTarget() {
  locked = null;
  recent.length = 0;
  lastReading = null;
  stopSound();
  renderTargets();
}

function renderInstrument() {
  mode.value = 'preset';
  preset.replaceChildren(...current().tunings.map(entry => new Option(entry.label)));
  $('instrument-tip').textContent = current().hint;
  $('instrument-tip').hidden = !current().hint;
  resetTarget();
}

async function playReference() {
  if (locked === null) return;
  quietUntil = performance.now() + 1350;
  recent.length = 0;
  lastReading = null;
  showReading(null);
  try {
    await playSound([[tuning().notes[locked]]], { duration: 1, a4: a4() });
  } catch {
    $('mic-status').textContent = 'Reference audio is unavailable in this browser.';
  }
}

function stopMic(message = 'Microphone off. Reference tones are still available.') {
  request++;
  starting = false;
  cancelAnimationFrame(frame);
  stream?.getTracks().forEach(track => track.stop());
  source?.disconnect();
  stream = source = analyser = null;
  recent.length = 0;
  lastReading = null;
  $('mic').textContent = 'Start microphone';
  $('mic').setAttribute('aria-pressed', 'false');
  $('mic-status').textContent = message;
  showReading(null);
}

async function startMic() {
  if (!navigator.mediaDevices?.getUserMedia) {
    $('mic-status').textContent = 'Microphone access requires HTTPS or localhost. You can still use reference tones.';
    return;
  }
  const attempt = ++request;
  starting = true;
  $('mic').textContent = 'Cancel microphone';
  $('mic-status').textContent = 'Waiting for microphone access…';
  try {
    const audio = await wakeAudio();
    if (attempt !== request) return;
    const input = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    if (attempt !== request) {
      input.getTracks().forEach(track => track.stop());
      return;
    }
    starting = false;
    stream = input;
    source = audio.createMediaStreamSource(input);
    analyser = audio.createAnalyser();
    analyser.fftSize = 8192;
    source.connect(analyser);
    input.getAudioTracks()[0]?.addEventListener('ended', () => {
      if (attempt === request) stopMic('Microphone disconnected. You can try again or use reference tones.');
    }, { once: true });
    $('mic').textContent = 'Stop microphone';
    $('mic').setAttribute('aria-pressed', 'true');
    $('mic-status').textContent = 'Microphone on · play one string, then let it ring.';
    const samples = new Float32Array(analyser.fftSize);
    let last = 0;
    function listen(now) {
      if (attempt !== request) return;
      if (now - last >= 100 && now >= quietUntil) {
        last = now;
        analyser.getFloatTimeDomainData(samples);
        const hz = estimatePitch(samples, audio.sampleRate);
        if (!hz || (recent.length && Math.abs(12 * Math.log2(hz / recent.at(-1))) > .7)) recent.length = 0;
        if (hz) {
          recent.push(hz);
          if (recent.length > 5) recent.shift();
        }
        lastReading = [...recent].sort((a, b) => a - b)[Math.floor(recent.length / 2)] ?? null;
        showReading(lastReading);
      }
      frame = requestAnimationFrame(listen);
    }
    frame = requestAnimationFrame(listen);
  } catch (error) {
    if (attempt !== request) return;
    stopMic(error.name === 'NotAllowedError'
      ? 'Microphone permission was declined. Allow access in your browser or use reference tones.'
      : 'Could not start the microphone. Check your input device or use reference tones.');
  }
}

instrument.replaceChildren(...instruments.map(entry => new Option(entry.name)));
instrument.addEventListener('change', renderInstrument);
preset.addEventListener('change', () => { mode.value = 'preset'; resetTarget(); });
mode.addEventListener('change', resetTarget);
reference.addEventListener('change', () => { reference.value = a4(); renderTargets(); });
$('auto').addEventListener('click', resetTarget);
$('reference-tone').addEventListener('click', playReference);
$('mic').addEventListener('click', () => stream || starting ? stopMic() : startMic());
window.addEventListener('pagehide', () => { stopMic(); stopSound(); });
renderInstrument();
