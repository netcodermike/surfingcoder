import { get, make, setStatus, shuffled } from '../../assets/game-editions.mjs';

const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const empty = Array.from({ length: 81 }, (_, i) => i);
const row = i => Math.floor(i / 9);
const col = i => i % 9;
const box = i => 3 * Math.floor(row(i) / 3) + Math.floor(col(i) / 3);
const peers = empty.map(i => empty.filter(j => i !== j && (row(i) === row(j) || col(i) === col(j) || box(i) === box(j))));
let entries, givens, solution, selected, marked;

function countSolutions(grid, limit = 2) {
  let best = -1, options;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]) continue;
    const used = new Set(peers[i].map(j => grid[j]));
    const candidates = digits.filter(value => !used.has(value));
    if (!candidates.length) return 0;
    if (!options || candidates.length < options.length) {
      best = i;
      options = candidates;
      if (options.length === 1) break;
    }
  }
  if (best < 0) return 1;
  let count = 0;
  for (const value of options) {
    grid[best] = value;
    count += countSolutions(grid, limit - count);
    if (count >= limit) break;
  }
  grid[best] = 0;
  return count;
}

function start() {
  const order = shuffled(digits, Math.random);
  solution = empty.map(i => order[(3 * row(i) + Math.floor(row(i) / 3) + col(i)) % 9]);
  givens = [...solution];
  const target = Number(get('difficulty').value);
  let remaining = givens.length;
  for (const cell of shuffled(empty, Math.random)) {
    if (remaining <= target) break;
    givens[cell] = 0;
    if (countSolutions(givens) === 1) remaining--;
    else givens[cell] = solution[cell];
  }
  entries = [...givens];
  selected = givens.indexOf(0);
  marked = [];
  setStatus(remaining + ' clues. This puzzle has one solution.');
  draw();
}

function draw(focus = false) {
  get('board').replaceChildren(...entries.map((value, i) => {
    const classes = [
      givens[i] && 'given', selected === i && 'selected', marked.includes(i) && 'wrong',
      (col(i) === 2 || col(i) === 5) && 'box-edge', (row(i) === 2 || row(i) === 5) && 'band-edge',
    ].filter(Boolean).join(' ');
    const button = make('button', value || '', {
      class: classes, tabindex: selected === i ? 0 : -1, 'aria-pressed': selected === i,
      'aria-label': 'Row ' + (row(i) + 1) + ', column ' + (col(i) + 1) + ', ' + (value || 'empty') + (givens[i] ? ', given' : ''),
    });
    button.onclick = () => { selected = i; draw(true); };
    return button;
  }));
  if (focus) get('board').children[selected].focus();
}

function enter(value, focus = false) {
  if (givens[selected]) { setStatus('Choose a square without a given clue.'); return; }
  entries[selected] = value;
  marked = [];
  setStatus(entries.every((entry, i) => entry === solution[i]) ? 'Puzzle solved!' : '');
  draw(focus);
}

for (const value of [...digits, 0]) {
  const key = make('button', value || 'Erase');
  key.onclick = () => enter(value, true);
  get('numbers').append(key);
}
get('board').onkeydown = event => {
  const offset = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[event.key];
  if (/^[1-9]$/.test(event.key) || ['Delete', 'Backspace', '0'].includes(event.key)) {
    event.preventDefault();
    enter(Number(event.key) || 0, true);
  } else if (offset) {
    event.preventDefault();
    selected = Math.max(0, Math.min(80, selected + offset));
    draw(true);
  }
};
get('new').onclick = start;
get('difficulty').onchange = start;
get('check').onclick = () => {
  marked = empty.filter(i => entries[i] && peers[i].some(j => entries[j] === entries[i]));
  setStatus(marked.length ? 'Highlighted squares repeat a digit.' : entries.includes(0) ? 'No conflicts so far.' : 'Puzzle solved!');
  draw();
};
get('hint').onclick = () => {
  const wrong = empty.find(i => entries[i] !== solution[i]);
  if (wrong == null) { setStatus('The grid is already solved.'); return; }
  if (entries[selected] === solution[selected]) selected = wrong;
  enter(solution[selected]);
  if (entries.includes(0)) setStatus('Filled row ' + (row(selected) + 1) + ', column ' + (col(selected) + 1) + '.');
};
get('reveal').onclick = () => { entries = [...solution]; marked = []; setStatus('Solution revealed.'); draw(); };
start();
