export function safeStream(value) { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol))
    throw Error('Use an HTTP(S) audio stream'); if (locationSafe() && url.protocol !== 'https:')
    throw Error('HTTPS pages need HTTPS streams'); return url.href; }
function locationSafe() { return typeof location !== 'undefined' && location.protocol === 'https:'; }
export function nextIndex(index, count, shuffle = false, random = Math.random()) { if (count < 1)
    return -1; return shuffle ? Math.min(count - 1, Math.floor(random * count)) : (index + 1) % count; }
