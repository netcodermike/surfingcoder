export const intervals = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave'];
export function question(seed = Math.random()) { const n = Math.min(11, Math.floor(seed * 12)) + 1; return { root: 48 + Math.floor(seed * 100) % 18, interval: n }; }
export function score(correct, total) { return total ? Math.round(100 * correct / total) : 0; }
