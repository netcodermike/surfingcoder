const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const naturals = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const pitchClass = midi => ((midi % 12) + 12) % 12;
export const pitchName = midi => names[pitchClass(midi)];
export const noteName = midi => `${pitchName(midi)}${Math.floor(midi / 12) - 1}`;
export const frequency = (midi, a4 = 440) => a4 * 2 ** ((midi - 69) / 12);
export const midiValue = (hz, a4 = 440) => 69 + 12 * Math.log2(hz / a4);
export const centsFrom = (hz, target) => 1200 * Math.log2(hz / target);

export function parseNote(text) {
  const [, letter, accidental, octave] = /^([A-G])([#b]?)(-?\d+)$/.exec(text);
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return 12 * (Number(octave) + 1) + naturals[letter] + shift;
}
