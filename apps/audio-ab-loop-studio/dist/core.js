export function loopBounds(a, b, duration) { if (![a, b, duration].every(Number.isFinite) || duration <= 0 || a < 0 || b <= a || b > duration)
    throw Error('Use 0 ≤ A < B ≤ recording duration'); return { a, b }; }
export function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`; }
