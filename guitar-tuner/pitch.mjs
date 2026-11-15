import { centsFrom, frequency, midiValue } from './music.mjs';

// Look for the first strong periodic match with a normalized difference function.
// Each lag compares the same number of samples so low pitches retain their resolution.
export function estimatePitch(buffer, sampleRate) {
  const downsample = 2;
  const rate = sampleRate / downsample;
  const signal = new Float32Array(Math.floor(buffer.length / downsample));
  let sum = 0;
  for (let i = 0; i < signal.length; i++) {
    const first = downsample * i;
    signal[i] = (buffer[first] + buffer[first + 1]) / downsample;
    sum += signal[i];
  }
  const mean = sum / signal.length;
  let power = 0;
  for (const value of signal) power += (value - mean) ** 2;
  if (power / signal.length < .000036) return null;

  const firstLag = Math.max(2, Math.floor(rate / 1800));
  const lastLag = Math.min(Math.ceil(rate / 24), Math.floor(signal.length / 2));
  const window = signal.length - lastLag;
  const difference = new Float64Array(lastLag + 1);
  let running = 0;
  let candidate = 0;
  for (let lag = 1; lag <= lastLag; lag++) {
    let cost = 0;
    for (let i = 0; i < window; i++) cost += (signal[i] - signal[i + lag]) ** 2;
    running += cost;
    difference[lag] = running ? (cost * lag) / running : 1;
    if (lag > firstLag && difference[lag - 1] < .17 && difference[lag] > difference[lag - 1]) {
      candidate = lag - 1;
      break;
    }
  }
  if (!candidate) return null;
  // Refine around the coarse match at the full sample rate for high notes.
  const coarse = candidate * downsample;
  const radius = downsample + 1;
  const local = Array.from({ length: 2 * radius + 1 }, (_, index) => {
    const lag = coarse - radius + index;
    let cost = 0;
    for (let i = 0; i < buffer.length - coarse - radius; i++) cost += (buffer[i] - buffer[i + lag]) ** 2;
    return cost;
  });
  const best = local.indexOf(Math.min(...local));
  const left = local[best - 1];
  const center = local[best];
  const right = local[best + 1];
  const adjustment = .5 * (left - right) / (left - 2 * center + right);
  return sampleRate / (coarse - radius + best + (Number.isFinite(adjustment) ? adjustment : 0));
}

export function pitchReading(hz, targets, locked, a4 = 440) {
  const actual = midiValue(hz, a4);
  const midi = locked ?? (targets.length ? targets.reduce((nearest, target) =>
    Math.abs(target - actual) < Math.abs(nearest - actual) ? target : nearest) : Math.round(actual));
  return { midi, detected: Math.round(actual), cents: centsFrom(hz, frequency(midi, a4)) };
}
