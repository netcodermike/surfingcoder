import { pitchClass, pitchName } from './music.mjs';

export const guitar = [40, 45, 50, 55, 59, 64];
export const qualities = {
  major: ['Major', '', [0, 4, 7], ['1', '3', '5']],
  minor: ['Minor', 'm', [0, 3, 7], ['1', '♭3', '5']],
  power: ['Power (5)', '5', [0, 7], ['1', '5']],
  sus2: ['Suspended 2', 'sus2', [0, 2, 7], ['1', '2', '5']],
  sus4: ['Suspended 4', 'sus4', [0, 5, 7], ['1', '4', '5']],
  dim: ['Diminished', 'dim', [0, 3, 6], ['1', '♭3', '♭5']],
  aug: ['Augmented', 'aug', [0, 4, 8], ['1', '3', '♯5']],
  sixth: ['Major 6', '6', [0, 4, 7, 9], ['1', '3', '5', '6']],
  min6: ['Minor 6', 'm6', [0, 3, 7, 9], ['1', '♭3', '5', '6']],
  seven: ['Dominant 7', '7', [0, 4, 7, 10], ['1', '3', '5', '♭7']],
  maj7: ['Major 7', 'maj7', [0, 4, 7, 11], ['1', '3', '5', '7']],
  min7: ['Minor 7', 'm7', [0, 3, 7, 10], ['1', '♭3', '5', '♭7']],
  dim7: ['Diminished 7', 'dim7', [0, 3, 6, 9], ['1', '♭3', '♭5', '𝄫7']],
  halfDim: ['Half-diminished 7', 'm7♭5', [0, 3, 6, 10], ['1', '♭3', '♭5', '♭7']],
  add9: ['Add 9', 'add9', [0, 4, 7, 14], ['1', '3', '5', '9']],
  nine: ['Dominant 9', '9', [0, 4, 7, 10, 14], ['1', '3', '5', '♭7', '9']],
  maj9: ['Major 9', 'maj9', [0, 4, 7, 11, 14], ['1', '3', '5', '7', '9']],
  min9: ['Minor 9', 'm9', [0, 3, 7, 10, 14], ['1', '♭3', '5', '♭7', '9']],
};

export const symbol = (root, quality) => pitchName(root) + qualities[quality][1];
export const playedNotes = frets => frets.flatMap((fret, string) => fret < 0 ? [] : [guitar[string] + fret]);
const letters = 'CDEFGAB';
const natural = [0, 2, 4, 5, 7, 9, 11];

export function chordTones(root, quality) {
  const [, , intervals, degrees] = qualities[quality];
  const rootLetter = letters.indexOf(pitchName(root)[0]);
  return intervals.map((interval, index) => {
    const degree = degrees[index];
    const letter = (rootLetter + Number(degree.slice(-1)) - 1) % letters.length;
    const pc = pitchClass(root + interval);
    const offset = pitchClass(pc - natural[letter] + 6) - 6;
    return { pc, degree, name: letters[letter] + (offset >= 0 ? '♯'.repeat(offset) : '♭'.repeat(-offset)) };
  });
}

export function identifyChord(frets) {
  const notes = playedNotes(frets);
  if (!notes.length) return [];
  const bass = pitchClass(Math.min(...notes));
  const played = new Set(notes.map(pitchClass));
  const candidates = [];
  const roots = [bass, ...[...played].filter(pc => pc !== bass)];
  for (const root of roots) {
    for (const [quality, [, , intervals]] of Object.entries(qualities)) {
      if (intervals.length !== played.size || !intervals.every(interval => played.has(pitchClass(root + interval)))) continue;
      candidates.push(symbol(root, quality) + (bass === root ? '' : '/' + pitchName(bass)));
    }
  }
  return candidates;
}

const openShapes = {
  '0:major': [-1, 3, 2, 0, 1, 0],
  '2:major': [-1, -1, 0, 2, 3, 2],
  '4:major': [0, 2, 2, 1, 0, 0],
  '7:major': [3, 2, 0, 0, 0, 3],
  '9:major': [-1, 0, 2, 2, 2, 0],
  '2:minor': [-1, -1, 0, 2, 3, 1],
  '4:minor': [0, 2, 2, 0, 0, 0],
  '9:minor': [-1, 0, 2, 2, 1, 0],
  '2:seven': [-1, -1, 0, 2, 1, 2],
  '4:seven': [0, 2, 0, 1, 0, 0],
  '9:seven': [-1, 0, 2, 0, 2, 0],
  '11:seven': [-1, 2, 1, 2, 0, 2],
};

const voicingCache = new Map();

function enoughFingers(frets) {
  let fingers = 0;
  for (const fret of new Set(frets.filter(value => value > 0))) {
    let canBar = false;
    for (const value of frets) {
      if (value >= 0 && value < fret) canBar = false;
      if (value === fret && !canBar) {
        fingers++;
        canBar = true;
      }
    }
  }
  return fingers <= 4;
}

export function findVoicings(root, quality) {
  const key = `${root}:${quality}`;
  if (voicingCache.has(key)) return voicingCache.get(key);
  const [, , intervals] = qualities[quality];
  const pcs = intervals.map(interval => pitchClass(root + interval));
  const masks = new Map(pcs.map((pc, index) => [pc, 1 << index]));
  const full = (1 << pcs.length) - 1;
  // Extended ninth voicings may omit the unaltered fifth when needed.
  const required = intervals.length === 5 ? full & ~(1 << intervals.indexOf(7)) : full;
  const choices = [];
  const seen = new Set();
  const preferred = openShapes[key];

  for (let position = 1; position <= 12; position++) {
    const span = [0, position, position + 1, position + 2, position + 3];
    const options = guitar.map(open => [-1, ...span.filter(fret => masks.has(pitchClass(open + fret)))]);
    const frets = Array(guitar.length).fill(-1);
    function search(string, mask) {
      if (string < guitar.length) {
        for (const fret of options[string]) {
          frets[string] = fret;
          const bit = fret >= 0 ? masks.get(pitchClass(guitar[string] + fret)) : 0;
          search(string + 1, mask | bit);
        }
        return;
      }
      if ((mask & required) !== required || !enoughFingers(frets)) return;
      const shapeKey = frets.join(',');
      if (seen.has(shapeKey)) return;
      seen.add(shapeKey);
      const first = frets.findIndex(fret => fret >= 0);
      const end = frets.findLastIndex(fret => fret >= 0);
      const internalMutes = frets.slice(first, end).filter(fret => fret < 0).length;
      const stopped = frets.filter(fret => fret > 0);
      const lowFret = Math.min(...stopped, 16);
      const highFret = Math.max(...stopped, 0);
      // Favor reachable positions, root in the bass, full chords, and clean strumming lanes.
      let score = 3 * internalMutes + Math.max(0, highFret - lowFret) * 1.2 + highFret * .43;
      score += pitchClass(Math.min(...playedNotes(frets))) === root ? 0 : 7;
      score += mask === full ? 0 : 4;
      score -= frets.filter(fret => fret >= 0).length * (quality === 'power' ? .12 : .65);
      if (preferred?.join(',') === shapeKey) score -= 100;
      choices.push({ frets: [...frets], score });
    }
    search(0, 0);
  }
  choices.sort((a, b) => a.score - b.score);
  const result = choices.slice(0, 16).map(choice => choice.frets);
  voicingCache.set(key, result);
  return result;
}

const major = offset => [offset, 'major'];
const minor = offset => [offset, 'minor'];
const seven = offset => [offset, 'seven'];

export const progressions = [
  { title: 'I–V–vi–IV · Pop', degrees: ['I', 'V', 'vi', 'IV'], steps: [major(0), major(7), minor(9), major(5)] },
  { title: 'I–IV–V–I · Three-chord turnaround', degrees: ['I', 'IV', 'V', 'I'], steps: [major(0), major(5), major(7), major(0)] },
  { title: 'ii–V–I · Jazz cadence', degrees: ['ii⁷', 'V⁷', 'Imaj⁷'], steps: [[2, 'min7'], seven(7), [0, 'maj7']] },
  { title: 'i–♭VI–♭III–♭VII · Minor rock', degrees: ['i', '♭VI', '♭III', '♭VII'], steps: [minor(0), major(8), major(3), major(10)] },
  { title: 'I–vi–IV–V · Doo-wop', degrees: ['I', 'vi', 'IV', 'V'], steps: [major(0), minor(9), major(5), major(7)] },
  { title: '12-bar blues', degrees: ['I⁷', 'I⁷', 'I⁷', 'I⁷', 'IV⁷', 'IV⁷', 'I⁷', 'I⁷', 'V⁷', 'IV⁷', 'I⁷', 'V⁷'],
    steps: [seven(0), seven(0), seven(0), seven(0), seven(5), seven(5), seven(0), seven(0), seven(7), seven(5), seven(0), seven(7)] },
];

export function progressionInKey(pattern, key) {
  return pattern.steps.map(([interval, quality], index) => {
    const root = pitchClass(key + interval);
    return { label: symbol(root, quality), degree: pattern.degrees[index], frets: findVoicings(root, quality)[0] };
  });
}
