import { canvasCell, get, setStatus } from '../../assets/game-editions.mjs';
import { search } from './rules.mjs';

const board = get('board');
const ctx = board.getContext('2d');
const cols = 25, rows = 15, cell = board.width / cols;
const key = 'surfingcoder-pathfinding-map-v1';
let grid, cursor, start, goal, result;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

function render() {
  const paint = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * cell, y * cell, cell - 1, cell - 1);
  };
  ctx.fillStyle = '#251d30';
  ctx.fillRect(0, 0, board.width, board.height);
  grid.forEach((row, y) => row.forEach((tile, x) => paint(x, y, tile === 0 ? '#13101c' : tile === 5 ? '#906346' : '#40314e')));
  result?.visited.forEach(([x, y]) => paint(x, y, '#76568f'));
  result?.path.forEach(([x, y]) => paint(x, y, '#99e4d4'));
  paint(...start, '#69cec4');
  paint(...goal, '#ffc291');
  ctx.strokeStyle = '#faebff';
  ctx.lineWidth = 2;
  ctx.strokeRect(cursor[0] * cell + 2, cursor[1] * cell + 2, cell - 5, cell - 5);
}

function reset() {
  grid = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => x === 10 && y > 2 && y < 12 ? 0 : x >= 13 && x <= 17 && y >= 5 && y <= 9 ? 5 : 1));
  start = [3, 7];
  goal = [21, 7];
  cursor = [...start];
  result = null;
  setStatus('Teal is start. Peach is goal. Find a route through the example map or paint your own.');
  render();
}

function paint() {
  const [x, y] = cursor;
  const tool = get('tool').value;
  if (tool === 'start' || tool === 'goal') {
    if (same(cursor, tool === 'start' ? goal : start)) { setStatus('Choose different start and goal squares.'); return; }
    if (tool === 'start') start = [...cursor];
    else goal = [...cursor];
    grid[y][x] = 1;
  } else {
    if (same(cursor, start) || same(cursor, goal)) { setStatus('Move the endpoint before painting this square.'); return; }
    grid[y][x] = { wall: 0, mud: 5, clear: 1 }[tool];
  }
  result = null;
  setStatus('Painted ' + tool + ' at column ' + (x + 1) + ', row ' + (y + 1) + '.');
  render();
}

board.onpointerdown = event => { cursor = canvasCell(board, event, cols, rows); paint(); };
board.onkeydown = event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); paint(); return; }
  const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key];
  if (!delta) return;
  event.preventDefault();
  cursor = [Math.max(0, Math.min(cols - 1, cursor[0] + delta[0])), Math.max(0, Math.min(rows - 1, cursor[1] + delta[1]))];
  setStatus('Cursor at column ' + (cursor[0] + 1) + ', row ' + (cursor[1] + 1) + '.');
  render();
};
get('run').onclick = () => {
  result = search(grid, start, goal, get('algorithm').value);
  setStatus(result.path.length
    ? (result.path.length - 1) + ' steps · Cost ' + result.cost + ' · ' + result.visited.length + ' cells visited'
    : 'No route. ' + result.visited.length + ' cells visited.');
  render();
};
get('reset').onclick = reset;
get('save').onclick = () => {
  try { localStorage.setItem(key, JSON.stringify({ grid, start, goal })); setStatus('Map saved in this browser.'); }
  catch { setStatus('Browser storage is unavailable.'); }
};
get('load').onclick = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (!saved) { setStatus('There is no saved map in this browser yet.'); return; }
    const validPoint = point => Array.isArray(point) && point.length === 2 &&
      point.every(Number.isInteger) && [1, 5].includes(saved.grid[point[1]]?.[point[0]]);
    if (!Array.isArray(saved.grid) || saved.grid.length !== rows ||
      saved.grid.some(row => !Array.isArray(row) || row.length !== cols || row.some(tile => ![0, 1, 5].includes(tile))) ||
      !validPoint(saved.start) || !validPoint(saved.goal) || same(saved.start, saved.goal)) throw Error('Invalid map');
    ({ grid, start, goal } = saved);
    cursor = [...start];
    result = null;
    setStatus('Saved map loaded.');
    render();
  } catch { setStatus('The saved map could not be loaded.'); }
};
reset();
