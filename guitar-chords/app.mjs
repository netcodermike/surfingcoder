import { noteName, pitchClass, pitchName } from './music.mjs';
import { chordTones, findVoicings, guitar, identifyChord, playedNotes, progressionInKey, progressions, qualities, symbol } from './chords.mjs';
import { playSound, stopSound } from './synth.mjs';

const $ = id => document.getElementById(id);
const roots = Array.from({ length: 12 }, (_, index) => index);
const selectors = ['root', 'library-root', 'key'];
const viewButtons = [...document.querySelectorAll('[data-view]')];
const storageKey = 'surfingcoder-guitar-progression-v1';
const maxLength = 24;
let shapes;
let frets;
let custom = false;
let sequence = restoreProgression();
let timer;
let playback = 0;

const root = () => Number($('root').value);
const quality = () => $('quality').value;
const status = message => { $('status').textContent = message; };

function restoreProgression() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(stored) && stored.length <= maxLength && stored.every(entry =>
      entry && typeof entry.label === 'string' && typeof entry.degree === 'string' &&
      Array.isArray(entry.frets) && entry.frets.length === guitar.length &&
      entry.frets.some(fret => fret >= 0) && entry.frets.every(fret => Number.isInteger(fret) && fret >= -1 && fret <= 20))) return stored;
  } catch {
    // A blocked or invalid storage record leaves the starter progression available.
  }
  return progressionInKey(progressions[0], 0);
}

function saveProgression() {
  try { localStorage.setItem(storageKey, JSON.stringify(sequence)); }
  catch { status('Progression updated for this session. Browser storage is unavailable.'); }
}

function showView(view) {
  for (const button of viewButtons) {
    const active = button.dataset.view === view;
    $(button.dataset.view).hidden = !active;
    button.setAttribute('aria-pressed', String(active));
  }
}

function showShape(shape) {
  frets = [...shape];
  $('position').value = String(Math.min(16, Math.max(1, Math.min(...frets.filter(fret => fret > 0), 16))));
  if (!frets.some(fret => fret > 0)) $('position').value = '1';
  renderShape();
}

function loadRecipe() {
  shapes = findVoicings(root(), quality());
  $('voicing').replaceChildren(...shapes.map((shape, index) =>
    new Option(`${index + 1} · ${shape.map(fret => fret < 0 ? '×' : fret).join('  ')}`, index)));
  $('voicing').append(new Option('Custom shape', 'custom'));
  $('custom-name').value = '';
  custom = false;
  showShape(shapes[0]);
}

function renderBoard() {
  const table = $('fretboard');
  const head = document.createElement('thead');
  const header = head.insertRow();
  for (const label of ['Fret', ...guitar.map(note => pitchName(note))]) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    header.append(cell);
  }
  const position = Number($('position').value);
  const body = document.createElement('tbody');
  const notes = new Set(chordTones(root(), quality()).map(tone => tone.pc));
  for (const fret of [-1, 0, position, position + 1, position + 2, position + 3, position + 4]) {
    const row = body.insertRow();
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = fret < 0 ? 'Mute' : fret === 0 ? 'Open' : fret;
    row.append(heading);
    guitar.forEach((open, string) => {
      const cell = row.insertCell();
      const button = document.createElement('button');
      const pressed = frets[string] === fret;
      button.type = 'button';
      button.dataset.string = string;
      button.dataset.fret = fret;
      button.setAttribute('aria-pressed', String(pressed));
      const action = fret < 0 ? 'mute' : `${fret ? 'fret ' + fret : 'open'}, ${noteName(open + fret)}`;
      button.setAttribute('aria-label', `String ${guitar.length - string}, ${action}`);
      button.textContent = fret < 0 ? '×' : pressed ? pitchName(open + fret) : notes.has(pitchClass(open + fret)) ? '•' : '·';
      button.addEventListener('click', () => {
        frets[string] = fret;
        custom = true;
        $('voicing').value = 'custom';
        renderShape();
        table.querySelector(`[data-string="${string}"][data-fret="${fret}"]`).focus();
      });
      cell.append(button);
    });
  }
  table.replaceChildren(head, body);
}

function shapeName() {
  if (!custom) return symbol(root(), quality());
  return $('custom-name').value.trim() || identifyChord(frets)[0] || 'Custom chord';
}

function renderShape() {
  renderBoard();
  const played = playedNotes(frets);
  const tones = custom ? [...new Set(played.map(pitchClass))].map(pc => ({ name: pitchName(pc) })) : chordTones(root(), quality());
  const matches = custom ? identifyChord(frets) : [];
  const formula = $('chord-tones');
  formula.replaceChildren(...tones.map(tone => {
    const item = document.createElement('li');
    item.textContent = tone.degree ? `${tone.name} · ${tone.degree}` : tone.name;
    return item;
  }));
  $('shape-type').textContent = custom ? 'Custom shape' : 'Selected chord';
  $('chord-name').textContent = shapeName();
  const grip = frets.map(fret => fret < 0 ? '×' : fret).join(' · ');
  $('shape-info').textContent = played.length
    ? `Frets: ${grip} · Bass: ${noteName(Math.min(...played))}${matches.length > 1 ? ' · Also ' + matches.slice(1, 4).join(', ') : ''}`
    : 'All strings are muted.';
  $('custom-label').hidden = !custom;
  $('add-chord').disabled = $('strum').disabled = !played.length;
}

function renderLibrary() {
  const chosen = Number($('library-root').value);
  $('chord-list').replaceChildren(...Object.entries(qualities).map(([kind, [label]]) => {
    const button = document.createElement('button');
    const name = document.createElement('strong');
    const details = document.createElement('span');
    button.type = 'button';
    name.textContent = symbol(chosen, kind);
    details.textContent = label;
    button.append(name, details);
    button.addEventListener('click', () => {
      $('root').value = chosen;
      $('quality').value = kind;
      loadRecipe();
      showView('builder');
      $('root').focus();
    });
    return button;
  }));
}

function renderProgression() {
  $('progression-list').replaceChildren(...sequence.map((entry, index) => {
    const row = document.createElement('li');
    const shape = document.createElement('button');
    const remove = document.createElement('button');
    shape.type = remove.type = 'button';
    shape.textContent = [entry.degree, entry.label].filter(Boolean).join(' · ');
    shape.setAttribute('aria-label', `Edit shape for chord ${index + 1}, ${entry.label}`);
    shape.addEventListener('click', () => {
      custom = true;
      $('voicing').value = 'custom';
      $('custom-name').value = entry.label;
      showShape(entry.frets);
      showView('builder');
      $('strum').focus();
      status('Shape loaded. Add it to the progression to keep a variation.');
    });
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove chord ${index + 1}, ${entry.label}`);
    remove.addEventListener('click', () => {
      stopPlayback();
      sequence.splice(index, 1);
      saveProgression();
      renderProgression();
      const next = $('progression-list').children[Math.min(index, sequence.length - 1)];
      (next?.lastElementChild || $('load-pattern')).focus();
    });
    row.append(shape, remove);
    return row;
  }));
  $('empty-progression').hidden = Boolean(sequence.length);
  $('play-progression').disabled = $('clear-progression').disabled = !sequence.length;
}

const chosenPattern = () => progressions[Number($('pattern').value)];
const chosenKey = () => Number($('key').value);
function renderPreview() {
  $('progression-preview').textContent = chosenPattern().steps.map(([interval, kind]) =>
    symbol(pitchClass(chosenKey() + interval), kind)).join(' – ');
}

function stopPlayback() {
  playback++;
  clearTimeout(timer);
  stopSound();
  $('stop-progression').disabled = true;
}

async function play(notes, timing, message) {
  stopPlayback();
  const order = playback;
  try {
    const duration = await playSound(notes, timing);
    if (!duration || order !== playback) return;
    $('stop-progression').disabled = false;
    status(message);
    timer = setTimeout(() => {
      $('stop-progression').disabled = true;
      status('Playback finished.');
    }, duration * 1000);
  } catch { status('Audio playback is unavailable in this browser.'); }
}

for (const id of selectors) $(id).replaceChildren(...roots.map(pc => new Option(pitchName(pc), pc)));
$('quality').replaceChildren(...Object.entries(qualities).map(([kind, [label]]) => new Option(label, kind)));
$('position').replaceChildren(...Array.from({ length: 16 }, (_, index) => new Option(`Frets ${index + 1}–${index + 5}`, index + 1)));
$('pattern').replaceChildren(...progressions.map(({ title }, index) => new Option(title, index)));
for (const button of viewButtons) button.addEventListener('click', () => {
  if (button.dataset.view === 'library') {
    $('library-root').value = root();
    renderLibrary();
  }
  showView(button.dataset.view);
});
$('root').addEventListener('change', loadRecipe);
$('quality').addEventListener('change', loadRecipe);
$('library-root').addEventListener('change', renderLibrary);
$('position').addEventListener('change', renderBoard);
$('voicing').addEventListener('change', () => {
  custom = $('voicing').value === 'custom';
  if (custom) renderShape();
  else showShape(shapes[Number($('voicing').value)]);
});
$('custom-name').addEventListener('input', () => { $('chord-name').textContent = shapeName(); });
$('strum').addEventListener('click', () => play([playedNotes(frets)], { duration: 1.25 }, `Playing ${shapeName()}.`));
$('add-chord').addEventListener('click', () => {
  if (sequence.length >= maxLength) { status(`The progression can hold ${maxLength} chords. Remove one to add another.`); return; }
  const label = shapeName();
  stopPlayback();
  sequence.push({ label, degree: '', frets: [...frets] });
  status(`Added ${label}. Your progression has ${sequence.length} chords.`);
  saveProgression();
  renderProgression();
});
$('pattern').addEventListener('change', renderPreview);
$('key').addEventListener('change', renderPreview);
$('load-pattern').addEventListener('click', () => {
  stopPlayback();
  sequence = progressionInKey(chosenPattern(), chosenKey());
  status(`Loaded ${chosenPattern().title} in ${pitchName(chosenKey())}.`);
  saveProgression();
  renderProgression();
});
$('play-progression').addEventListener('click', () => {
  const bpm = Math.max(40, Math.min(220, $('bpm').valueAsNumber || 100));
  $('bpm').value = bpm;
  const spacing = 120 / bpm;
  play(sequence.map(entry => playedNotes(entry.frets)), { spacing, duration: spacing * .83 }, 'Playing your progression.');
});
$('stop-progression').addEventListener('click', () => { stopPlayback(); status('Playback stopped.'); });
$('clear-progression').addEventListener('click', () => {
  stopPlayback();
  sequence = [];
  status('Progression cleared.');
  saveProgression();
  renderProgression();
  $('load-pattern').focus();
});
window.addEventListener('pagehide', stopPlayback);
loadRecipe();
renderPreview();
renderProgression();
