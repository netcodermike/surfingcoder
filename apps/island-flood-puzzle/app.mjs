function neighbors(index, side) {
  const row = Math.floor(index / side), column = index % side;
  return [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]
    .filter(([y, x]) => x >= 0 && x < side && y >= 0 && y < side).map(([y, x]) => y * side + x);
}
export function island(board, side) {
  const colored = new Set([0]);
  for (const cell of colored) {
    for (const next of neighbors(cell, side)) if (board[next] === board[0]) colored.add(next);
  }
  return colored;
}
export function flood(board, side, color) {
  const filled = island(board, side);
  return board.map((value, index) => filled.has(index) ? color : value);
}
export function newBoard(seed, side = 6) {
  let state = seed >>> 0;
  return Array.from({ length: side ** 2 }, () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return Math.floor(state / 4294967296 * 5);
  });
}
export function budget(board, side) {
  let moves = 0;
  while (island(board, side).size < board.length) {
    const size = island(board, side).size;
    const choices = Array.from({ length: 5 }, (_, color) => flood(board, side, color));
    const sizes = choices.map(choice => island(choice, side).size);
    const best = Math.max(...sizes);
    if (best <= size) throw new Error('No adjacent color to absorb.');
    board = choices[sizes.indexOf(best)];
    moves++;
  }
  return moves + 2;
}

if (typeof document !== 'undefined') {
  const get = id => document.getElementById(id);
  const names = ['Lilac', 'Peach', 'Sea', 'Gold', 'Rose'];
  const glyphs = ['●', '◆', '✦', '▲', '■'];
  const size = 6;
  let original = newBoard(261115), board = original;
  const history = [];
  let limit = budget(board, size);
  function render() {
    const filled = island(board, size);
    const won = filled.size === board.length;
    const remaining = limit - history.length;
    const grid = get('island');
    grid.replaceChildren(...board.map((color, index) => {
      const cell = document.createElement('span');
      cell.className = 'tile hue-' + color + (filled.has(index) ? ' connected' : '');
      cell.textContent = glyphs[color];
      return cell;
    }));
    grid.setAttribute('aria-label', board.map((color, index) =>
      'Row ' + (1 + Math.floor(index / size)) + ' column ' + (1 + index % size) + ' ' + names[color] +
      (filled.has(index) ? ' connected' : '')).join(', '));
    get('reading').textContent = won ? 'Island complete in ' + history.length + ' moves!' :
      remaining ? filled.size + ' of 36 tiles · ' + remaining + ' moves left' : 'Out of moves. Undo or replay this board.';
    get('undo').disabled = !history.length;
    for (const button of get('colors').children) {
      button.disabled = won || remaining === 0;
      button.setAttribute('aria-pressed', String(Number(button.dataset.color) === board[0]));
    }
  }
  get('colors').append(...names.map((name, color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hue-' + color;
    button.dataset.color = color;
    button.textContent = glyphs[color] + ' ' + name;
    button.addEventListener('click', () => {
      if (board[0] === color) return;
      history.push(board);
      board = flood(board, size, color);
      render();
      if (button.disabled) get('undo').focus();
    });
    return button;
  }));
  function reset() {
    board = original;
    history.length = 0;
    limit = budget(original, size);
    render();
  }
  get('undo').addEventListener('click', () => { board = history.pop(); render(); });
  get('replay').addEventListener('click', reset);
  get('new-board').addEventListener('click', () => {
    original = newBoard(Math.random() * 2 ** 32);
    reset();
  });
  render();
}
