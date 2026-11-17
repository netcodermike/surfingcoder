import { get, make, setStatus } from '../../assets/game-editions.mjs';
import { defaultRooms, solve, validateRooms } from './rules.mjs';

let rooms = defaultRooms;
let state;

function render() {
  get('progress').textContent = 'Locks opened: ' + state.stage + ' / ' + rooms.length + ' · Attempts: ' + state.moves;
  get('clue').textContent = state.won ? 'You found the way out!' : rooms[state.stage].clue;
  get('inventory').replaceChildren(...(state.inventory.length ? state.inventory : ['Inventory empty']).map(item => make('span', item)));
  get('answer').disabled = get('answer-button').disabled = state.won;
}

function reset() {
  state = { stage: 0, inventory: [], moves: 0, won: false };
  get('answer').value = '';
  setStatus('Read the clue and try the lock.');
  render();
}

get('solve').onsubmit = event => {
  event.preventDefault();
  const answer = get('answer');
  if (!answer.value.trim() || state.won) return;
  const opened = solve(state, answer.value, rooms);
  setStatus(state.won ? 'Escaped in ' + state.moves + ' attempts!' : opened ? 'Lock opened. You found a ' + state.inventory.at(-1) + '.' : 'The lock stays closed. Try again.');
  answer.value = '';
  render();
  if (!state.won) answer.focus();
};
get('reset').onclick = reset;
get('editor').value = JSON.stringify(rooms, null, 2);
get('load').onclick = () => {
  try {
    const puzzles = JSON.parse(get('editor').value);
    if (!validateRooms(puzzles)) { setStatus('Provide 1–20 puzzles with nonempty clue, code, and item fields of at most 500 characters.'); return; }
    rooms = puzzles.map(puzzle => ({ ...puzzle, code: puzzle.code.trim() }));
    reset();
    setStatus('Custom room loaded.');
  } catch { setStatus('The room editor needs valid JSON.'); }
};
reset();
