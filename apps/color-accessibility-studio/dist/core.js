export function rgb(hex) { if (!/^#[0-9a-f]{6}$/i.test(hex))
    throw Error('Use six-digit #RRGGBB colors'); return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); }
export function luminance(hex) { const c = rgb(hex).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
export function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
export function assess(a, b) { const ratio = contrast(a, b); return { ratio, normalAA: ratio >= 4.5, normalAAA: ratio >= 7, largeAA: ratio >= 3, largeAAA: ratio >= 4.5 }; }
