import { canvasCell, get, random, setStatus, shuffled } from '../../assets/game-editions.mjs';

const board = get('board');
const ctx = board.getContext('2d');
const steps = [[0, -1], [1, 0], [0, 1], [-1, 0]];
let columns, rows, passages, player, moves, hint;

function draw() {
  const w = board.width / columns;
  const h = board.height / rows;
  const paint = (cell, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(cell % columns * w, Math.floor(cell / columns) * h, w + .1, h + .1);
  };
  passages.forEach((open, cell) => paint(cell, open ? '#393046' : '#15121f'));
  if (hint) {
    const previous = new Map([[player, null]]);
    const queue = [player];
    for (const cell of queue) {
      if (cell === exit()) break;
      for (const [x, y] of steps) {
        const target = cell + x + y * columns;
        if (passages[target] && !previous.has(target)) {
          previous.set(target, cell);
          queue.push(target);
        }
      }
    }
    for (let cell = exit(); cell != null; cell = previous.get(cell)) paint(cell, '#8261ac');
  }
  paint(exit(), '#ffbf91');
  paint(player, '#77e5d4');
}

function exit() { return (rows - 1) * columns - 2; }
function reset() {
  player = columns + 1;
  moves = 0;
  setStatus('Start at the teal square. Reach the peach exit.');
  draw();
}

function generate() {
  rows = Number(get('size').value);
  columns = rows + 10;
  const next = random(Number(get('seed').value) >>> 0);
  passages = Array(columns * rows).fill(false);
  const stack = [[1, 1]];
  passages[columns + 1] = true;
  while (stack.length) {
    const [x, y] = stack.at(-1);
    const direction = shuffled(steps, next).find(([dx, dy]) => {
      const xx = x + 2 * dx, yy = y + 2 * dy;
      return xx > 0 && xx < columns - 1 && yy > 0 && yy < rows - 1 && !passages[yy * columns + xx];
    });
    if (!direction) { stack.pop(); continue; }
    const [dx, dy] = direction;
    passages[(y + dy) * columns + x + dx] = true;
    passages[(y + 2 * dy) * columns + x + 2 * dx] = true;
    stack.push([x + 2 * dx, y + 2 * dy]);
  }
  reset();
}

function move(direction) {
  if (player === exit()) return;
  const [x, y] = steps[direction];
  const target = player + x + y * columns;
  if (!passages[target]) { setStatus('Wall. Try another direction.'); return; }
  player = target;
  moves++;
  setStatus(player === exit() ? 'Maze cleared in ' + moves + ' moves!' : 'Moves: ' + moves);
  draw();
}

get('new').onclick = generate;
get('reset').onclick = reset;
get('hint').onclick = event => {
  hint = !hint;
  event.currentTarget.setAttribute('aria-pressed', hint);
  event.currentTarget.textContent = hint ? 'Hide route' : 'Show route';
  draw();
};
document.querySelectorAll('[data-step]').forEach(button => button.onclick = () => move(Number(button.dataset.step)));
board.onkeydown = event => {
  const direction = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].indexOf(event.key);
  if (direction < 0) return;
  event.preventDefault();
  move(direction);
};
board.onclick = event => {
  const [x, y] = canvasCell(board, event, columns, rows);
  const direction = steps.findIndex(([dx, dy]) => x - player % columns === dx && y - Math.floor(player / columns) === dy);
  if (direction >= 0) move(direction);
};
generate();
