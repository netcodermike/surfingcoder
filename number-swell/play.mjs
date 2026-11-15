import { applyMove, createPuzzle, findSolution, firstPuzzle, makeTiles } from './puzzle.mjs';

const $ = id => document.getElementById(id);
const operatorButtons = [...document.querySelectorAll('[data-operator]')];
let puzzle = firstPuzzle;
let tiles;
let selected = null;
let operator = null;
const moves = [];

function render(message) {
  const finished = tiles.length === 1;
  const won = finished && tiles[0].value === puzzle.target;
  $('target').textContent = puzzle.target;
  $('moves-count').textContent = moves.length;
  $('tiles').replaceChildren(...tiles.map((tile, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'number-tile';
    button.dataset.tile = String(tile.id);
    button.textContent = tile.value;
    button.setAttribute('aria-label', `Tile ${index + 1}, value ${tile.value}`);
    button.setAttribute('aria-pressed', String(tile === selected));
    button.disabled = finished;
    button.addEventListener('click', () => chooseTile(tile));
    return button;
  }));

  for (const button of operatorButtons) {
    button.disabled = !selected || finished;
    button.setAttribute('aria-pressed', String(button.dataset.operator === operator));
  }
  $('undo').disabled = !moves.length;
  $('reset').disabled = !moves.length && !selected;
  $('hint').disabled = finished;
  $('empty-log').hidden = moves.length > 0;
  $('log').replaceChildren(...moves.map(move => {
    const row = document.createElement('li');
    row.textContent = move.label;
    return row;
  }));
  $('status').classList.toggle('solved', won);
  $('status').textContent = message ?? (won
    ? `You hit the target! ${tiles[0].expression.slice(1, -1)} = ${puzzle.target}.`
    : finished ? `You made ${tiles[0].value}. Undo a move and try another route to ${puzzle.target}.`
      : operator ? `${selected.value} ${operator} … Select the second tile.`
        : selected ? `Selected ${selected.value}. Choose an operation.` : 'Select your first number tile.');
}

function chooseTile(tile) {
  if (tile === selected) {
    selected = null;
    operator = null;
  } else if (selected && operator) {
    const next = applyMove(tiles, selected, operator, tile);
    if (!next) {
      $('status').textContent = `${selected.value} ${operator} ${tile.value} must give a positive whole number. Try another tile or operation.`;
      return;
    }
    const result = next.at(-1);
    moves.push({ previous: tiles, label: `${selected.value} ${operator} ${tile.value} = ${result.value}` });
    tiles = next;
    selected = null;
    operator = null;
    render();
    if (tiles.length > 1) document.querySelector(`[data-tile="${result.id}"]`).focus();
    else $(result.value === puzzle.target ? 'next' : 'undo').focus();
    return;
  } else {
    selected = tile;
  }
  render();
  if (selected) operatorButtons[0].focus();
  else document.querySelector(`[data-tile="${tile.id}"]`).focus();
}

function reset() {
  moves.length = 0;
  tiles = makeTiles(puzzle.numbers);
  selected = null;
  operator = null;
  render();
}

for (const button of operatorButtons) {
  button.addEventListener('click', () => {
    operator = button.dataset.operator;
    render();
    const nextTile = tiles.find(tile => tile !== selected);
    document.querySelector(`[data-tile="${nextTile.id}"]`).focus();
  });
}
$('undo').addEventListener('click', () => {
  tiles = moves.pop().previous;
  selected = null;
  operator = null;
  render('Move undone. Select a number tile.');
  if ($('undo').disabled) $('tiles').firstElementChild.focus();
});
$('reset').addEventListener('click', () => {
  reset();
  $('tiles').firstElementChild.focus();
});
$('next').addEventListener('click', () => {
  puzzle = createPuzzle(puzzle);
  reset();
  $('target').focus();
});
$('hint').addEventListener('click', () => {
  const solution = findSolution(tiles, puzzle.target);
  if (!solution) {
    $('status').textContent = 'There’s no route from these tiles. Undo a move or reset the puzzle.';
    return;
  }
  const [{ left, operator, right, result }] = solution;
  $('status').textContent = `Hint: ${left.value} ${operator} ${right.value} = ${result.value}.`;
});

reset();
