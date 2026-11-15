import { frequency } from './music.mjs';

let context;
let playback = 0;
const sounding = new Set();

export async function wakeAudio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw new Error('Web Audio is unavailable in this browser.');
  context ??= new Audio();
  if (context.state !== 'running') await context.resume();
  return context;
}

export function stopSound() {
  playback++;
  for (const voice of sounding) voice.stop();
  sounding.clear();
}

export async function playSound(chords, { spacing = 1.15, duration = .9, a4 = 440 } = {}) {
  stopSound();
  const order = playback;
  const audio = await wakeAudio();
  if (playback !== order) return 0;
  const start = audio.currentTime + .04;
  const stagger = .031;
  chords.forEach((notes, index) => notes.forEach((midi, string) => {
    const when = start + index * spacing + string * stagger;
    const stop = when + duration;
    const voice = audio.createOscillator();
    const gain = audio.createGain();
    voice.type = 'triangle';
    voice.frequency.value = frequency(midi, a4);
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(.19 / Math.sqrt(notes.length), when + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, stop);
    voice.connect(gain).connect(audio.destination);
    voice.onended = () => {
      sounding.delete(voice);
      voice.disconnect();
      gain.disconnect();
    };
    sounding.add(voice);
    voice.start(when);
    voice.stop(stop + .02);
  }));
  return .06 + (chords.length - 1) * spacing + duration + (chords.at(-1).length - 1) * stagger;
}
