export function estimatePitch(samples, rate) { let energy = 0; for (const x of samples)
    energy += x * x; if (energy / samples.length < .000015)
    return null; let best = 0, lag = 0, dipped = false; const start = Math.floor(rate / 1400), end = Math.min(Math.floor(rate / 24), Math.floor(samples.length / 2)); for (let t = start; t <= end; t++) {
    let a = 0, b = 0, d = 0;
    for (let i = 0; i < samples.length - t; i++) {
        a += samples[i] * samples[i + t];
        b += samples[i] ** 2;
        d += samples[i + t] ** 2;
    }
    const r = a / Math.sqrt(b * d || 1);
    if (r < 0)
        dipped = true;
    if (dipped && r > .88 && r > best) {
        best = r;
        lag = t;
    }
    if (lag && t > lag + 3 && r < best - .03)
        break;
} if (!lag || best < .88)
    return null; function corr(t) { let a = 0, b = 0, d = 0; for (let i = 0; i < samples.length - t; i++) {
    a += samples[i] * samples[i + t];
    b += samples[i] ** 2;
    d += samples[i + t] ** 2;
} return a / Math.sqrt(b * d || 1); } const left = corr(lag - 1), right = corr(lag + 1), shift = .5 * (left - right) / (left - 2 * best + right || 1); return rate / (lag + Math.max(-.5, Math.min(.5, shift))); }
export function pitchInfo(f, reference = 440) { if (!(f > 0 && reference > 0))
    throw Error('Positive frequencies required'); const midi = 69 + 12 * Math.log2(f / reference), nearest = Math.round(midi); return { midi: nearest, cents: 100 * (midi - nearest), frequency: f }; }
export const tunings = { Guitar: [40, 45, 50, 55, 59, 64], Bass: [28, 33, 38, 43], Violin: [55, 62, 69, 76], Viola: [48, 55, 62, 69], Cello: [36, 43, 50, 57], DoubleBass: [28, 33, 38, 43], Ukulele: [67, 60, 64, 69], Mandolin: [55, 62, 69, 76], Banjo: [67, 50, 55, 59, 62] };
