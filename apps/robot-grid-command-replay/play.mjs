import { get, make, setStatus } from '../../assets/game-editions.mjs';

const levels = [
  ['First crossing', ['S..#.', '##.#.', '..G..', '.###.', '.....']],
  ['Switchback', ['S.#..', '#.#.#', '#...#', '###.#', 'G...#']],
  ['Around the island', ['S....', '.###.', '.#G#.', '.#.#.', '.....']],
];
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
let map, x, y, heading, cursor, collisions;

function render() {
  const cells = map.flatMap((row, yy) => [...row].map((tile, xx) => {
    const robot = xx === x && yy === y;
    const kind = robot ? 'robot' : tile === '#' ? 'wall' : tile === 'G' ? 'target' : 'floor';
    return make('span', robot ? '→↓←↑'[heading] : tile === 'G' ? '◎' : '', { class: kind });
  }));
  get('board').style.gridTemplateColumns = 'repeat(5, 1fr)';
  get('board').replaceChildren(...cells);
  get('board').setAttribute('aria-label', 'Robot row ' + (y + 1) + ', column ' + (x + 1) + ', facing ' + ['east', 'south', 'west', 'north'][heading]);
  get('progress').textContent = 'Commands executed: ' + cursor + ' · Collisions: ' + collisions;
}

function reset() {
  map = levels[Number(get('challenge').value)][1];
  x = y = heading = cursor = collisions = 0;
  render();
  setStatus('Write a program to reach the marked goal.');
}

function run(single) {
  const commands = get('commands').value.toUpperCase().replace(/\s/g, '');
  if (!/^[FLR]+$/.test(commands)) { setStatus('Enter a sequence using F, L, and R.'); return; }
  const end = single ? Math.min(cursor + 1, commands.length) : commands.length;
  while (cursor < end && map[y][x] !== 'G') {
    const command = commands[cursor++];
    if (command === 'F') {
      const [dx, dy] = directions[heading];
      const tile = map[y + dy]?.[x + dx];
      if (tile && tile !== '#') { x += dx; y += dy; } else collisions++;
    } else heading = (heading + (command === 'R' ? 1 : 3)) % 4;
  }
  const atGoal = map[y][x] === 'G';
  setStatus(atGoal ? (collisions ? 'Goal reached. Try again without a collision.' : 'Goal reached with no collisions!') : cursor === commands.length ? 'Program finished. Revise the route and try again.' : 'Command executed.');
  render();
}

levels.forEach(([name], i) => get('challenge').append(make('option', name, { value: i })));
get('challenge').onchange = reset;
get('reset').onclick = reset;
get('commands').oninput = reset;
get('step').onclick = () => run(true);
get('program').onsubmit = event => { event.preventDefault(); reset(); run(false); };
reset();
