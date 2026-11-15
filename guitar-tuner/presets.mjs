import { parseNote } from './music.mjs';

const definitions = [
  ['Guitar · 6 strings', '', [
    ['Standard', 'E2 A2 D3 G3 B3 E4'],
    ['Drop D', 'D2 A2 D3 G3 B3 E4'],
    ['Half-step down', 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4'],
    ['D standard', 'D2 G2 C3 F3 A3 D4'],
    ['Drop C', 'C2 G2 C3 F3 A3 D4'],
    ['Open G', 'D2 G2 D3 G3 B3 D4'],
    ['Open D', 'D2 A2 D3 F#3 A3 D4'],
    ['DADGAD', 'D2 A2 D3 G3 A3 D4'],
    ['Open C', 'C2 G2 C3 G3 C4 E4'],
  ]],
  ['Guitar · 7 strings', '', [
    ['B standard', 'B1 E2 A2 D3 G3 B3 E4'],
    ['Drop A', 'A1 E2 A2 D3 G3 B3 E4'],
    ['A standard', 'A1 D2 G2 C3 F3 A3 D4'],
    ['Drop G', 'G1 D2 G2 C3 F3 A3 D4'],
  ]],
  ['Guitar · 12 strings', 'Pluck one string at a time. The four lower courses have octave pairs, and the two upper courses are in unison.', [
    ['Standard', 'E2 E3 A2 A3 D3 D4 G3 G4 B3 B3 E4 E4'],
    ['Drop D', 'D2 D3 A2 A3 D3 D4 G3 G4 B3 B3 E4 E4'],
    ['Half-step down', 'Eb2 Eb3 Ab2 Ab3 Db3 Db4 Gb3 Gb4 Bb3 Bb3 Eb4 Eb4'],
    ['D standard', 'D2 D3 G2 G3 C3 C4 F3 F4 A3 A3 D4 D4'],
  ], 'Course', true],
  ['Mandolin', 'Pluck one string of each paired course at a time.', [
    ['Standard in fifths', 'G3 D4 A4 E5'],
    ['GDAD · modal', 'G3 D4 A4 D5'],
    ['AEAE · cross tuning', 'A3 E4 A4 E5'],
  ], 'Course'],
  ['Banjo · 5 strings', 'String 5 is the short drone string.', [
    ['Open G', 'G4 D3 G3 B3 D4'],
    ['Double C', 'G4 C3 G3 C4 D4'],
    ['Sawmill · G modal', 'G4 D3 G3 C4 D4'],
    ['Standard C', 'G4 C3 G3 B3 D4'],
    ['Open D', 'F#4 D3 F#3 A3 D4'],
  ]],
  ['Banjo · tenor', '', [
    ['Standard · CGDA', 'C3 G3 D4 A4'],
    ['Irish tenor · GDAE', 'G2 D3 A3 E4'],
  ]],
  ['Bass · 4 strings', 'Use a clear, sustained pluck for the lowest strings.', [
    ['Standard', 'E1 A1 D2 G2'],
    ['Drop D', 'D1 A1 D2 G2'],
    ['Half-step down', 'Eb1 Ab1 Db2 Gb2'],
  ]],
  ['Bass · 5 strings', 'Use a clear, sustained pluck for the lowest strings.', [
    ['B standard', 'B0 E1 A1 D2 G2'],
    ['Drop A', 'A0 E1 A1 D2 G2'],
    ['High C', 'E1 A1 D2 G2 C3'],
  ]],
  ['Ukulele', 'High G is reentrant: the G string sits above middle C in pitch.', [
    ['High G · standard', 'G4 C4 E4 A4'],
    ['Low G', 'G3 C4 E4 A4'],
    ['D tuning', 'A4 D4 F#4 B4'],
  ]],
  ['Ukulele · baritone', '', [
    ['Standard · DGBE', 'D3 G3 B3 E4'],
    ['High D', 'D4 G3 B3 E4'],
  ]],
  ['Violin / fiddle', '', [
    ['Standard in fifths', 'G3 D4 A4 E5'],
    ['Cross A · AEAE', 'A3 E4 A4 E5'],
    ['Cross G · GDGD', 'G3 D4 G4 D5'],
  ]],
];

export const instruments = definitions.map(([name, hint, tunings, unit = 'String', paired = false]) => ({
  name, hint, unit, paired,
  tunings: tunings.map(([label, notes]) => ({
    label,
    notes: notes.split(' ').map(parseNote),
    spellings: notes.split(' ').map(note => note.replace('#', '♯').replace('b', '♭')),
  })),
}));
