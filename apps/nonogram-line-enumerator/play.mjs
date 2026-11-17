import { get, make, setStatus } from '../../assets/game-editions.mjs';

const levels = [[7, [3, 3]], [8, [4, 2]], [10, [2, 4, 2]], [11, [1, 2, 3]], [12, [2, 1, 2]]];
let marks, solutions;
const getRuns = row => row.join('').split(/0+/).filter(Boolean).map(run => run.length).join(',');

function render(focus) {
  get('row').replaceChildren(...marks.map((mark, i) => {
    const labels = ['unknown', 'filled', 'marked blank'];
    const cell = make('button', ['', '■', '×'][mark], {
      'aria-label': 'Cell ' + (i + 1) + ', ' + labels[mark],
      'data-state': mark,
    });
    cell.onclick = () => { marks[i] = (mark + 1) % 3; render(i); };
    return cell;
  }));
  if (focus != null) get('row').children[focus].focus();
}

function reset() {
  const [length, clues] = levels[Number(get('challenge').value)];
  marks = Array(length).fill(0);
  get('row').style.setProperty('--columns', length);
  solutions = [];
  for (let mask = 0; mask < 2 ** length; mask++) {
    const row = marks.map((_, i) => (mask >> i) & 1);
    if (getRuns(row) === clues.join(',')) solutions.push(row);
  }
  get('clues').textContent = 'Clues  ' + clues.join(' · ');
  get('clue-count').textContent = length + ' cells';
  setStatus('Fill the runs shown in the clue.');
  render();
}

levels.forEach(([length, clues], i) => get('challenge').append(make('option', length + ' cells · ' + clues.join(' / '), { value: i })));
get('challenge').onchange = reset;
get('reset').onclick = reset;
get('check').onclick = () => {
  const solved = solutions.some(row => row.every((filled, i) => filled === Number(marks[i] === 1)));
  setStatus(solved ? 'Solved! The runs match the clues.' : 'Your filled runs are ' + (getRuns(marks.map(value => Number(value === 1))) || 'empty') + '.');
};
get('hint').onclick = () => {
  const candidates = solutions.filter(row => row.every((filled, i) => marks[i] === 0 || marks[i] === 2 - filled));
  if (!candidates.length) { setStatus('Some marks conflict with the clues.'); return; }
  const forced = marks.findIndex((mark, i) => !mark && candidates.every(row => row[i] === candidates[0][i]));
  if (forced < 0) { setStatus('The clues leave more than one option for every unmarked cell.'); return; }
  marks[forced] = 2 - candidates[0][forced];
  setStatus('Cell ' + (forced + 1) + ' must be ' + (marks[forced] === 1 ? 'filled.' : 'blank.'));
  render();
};
reset();
