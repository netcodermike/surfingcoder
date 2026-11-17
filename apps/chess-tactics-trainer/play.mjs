import { get, make, setStatus } from '../../assets/game-editions.mjs';

const exercises = [
  { piece: 'queen', from: 'd2', to: 'e2', prompt: 'Give check with the queen along the e-file.' },
  { piece: 'knight', from: 'd5', to: 'f6', prompt: 'Give check with the knight from the f-file.' },
  { piece: 'rook', from: 'a2', to: 'a8', prompt: 'Give check with the rook along the eighth rank.' },
];
const glyph = { queen: '♕', knight: '♘', rook: '♖' };
const passed = new Set();
let index = 0;
let selected;

function render() {
  const puzzle = exercises[index];
  get('prompt').textContent = puzzle.prompt;
  get('progress').textContent = 'Exercise ' + (index + 1) + ' of ' + exercises.length + ' · Solved ' + passed.size;
  const squares = Array.from({ length: 64 }, (_, i) => {
    const x = i % 8, y = Math.floor(i / 8);
    const square = 'abcdefgh'[x] + (8 - y);
    const icons = { e8: '♚', e1: '♔', [puzzle.from]: glyph[puzzle.piece] };
    const name = { e8: 'black king', e1: 'white king', [puzzle.from]: 'white ' + puzzle.piece };
    const cell = make('button', icons[square] || '', {
      class: 'square-chess ' + ((x + y) % 2 ? 'black-square' : 'white-square') + (square === selected ? ' selected' : ''),
      'aria-label': square + (name[square] ? ', ' + name[square] : ''), 'data-square': square,
    });
    cell.onclick = () => {
      if (square === puzzle.from || !selected) {
        if (square !== puzzle.from) { setStatus('Select the white ' + puzzle.piece + ' first.'); return; }
        selected = square;
        render();
        get('board').querySelector('[data-square="' + square + '"]').focus();
      } else check(selected + square);
    };
    return cell;
  });
  get('board').replaceChildren(...squares);
}

function check(move) {
  const { from, to } = exercises[index];
  if (move !== from + to) { setStatus('Try another move that fits the prompt.'); return; }
  passed.add(index);
  selected = null;
  render();
  setStatus(passed.size === exercises.length ? 'Check! All exercises solved.' : 'Check! ' + from + ' to ' + to + '.');
}

get('submit-move').onsubmit = event => {
  event.preventDefault();
  check(get('move').value.toLowerCase().replace(/[\s-]/g, ''));
};
get('hint').onclick = () => {
  const { from, to } = exercises[index];
  setStatus('Try ' + from + ' to ' + to + '.');
};
get('next').onclick = () => {
  index = (index + 1) % exercises.length;
  selected = null;
  get('move').value = '';
  setStatus('White to move.');
  render();
};
setStatus('White to move.');
render();
