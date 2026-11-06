export const qualities = { Major: [0, 4, 7], Minor: [0, 3, 7], Dominant7: [0, 4, 7, 10], Major7: [0, 4, 7, 11], Minor7: [0, 3, 7, 10], Dominant9: [0, 4, 7, 10, 14], Diminished: [0, 3, 6], Sus4: [0, 5, 7] };
export function chord(root, quality, inversion = 0) { if (!qualities[quality] || !Number.isInteger(inversion) || inversion < 0)
    throw Error('Invalid chord'); const n = qualities[quality].map(x => 48 + root + x); for (let i = 0; i < inversion % n.length; i++)
    n.push(n.shift() + 12); return n; }
export function motion(a, b) { return a.map((x, i) => ({ from: x, to: b[i % b.length], semitones: b[i % b.length] - x })); }
