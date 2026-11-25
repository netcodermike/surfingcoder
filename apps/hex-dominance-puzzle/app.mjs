export const boards = [
  { name: 'Shoal', radius: 1, rocks: ['0,0'] },
  { name: 'Tide pools', radius: 2, rocks: ['0,0', '-1,2', '2,-1'] },
  { name: 'Breakwater', radius: 3, rocks: ['0,0', '1,0', '-2,1', '0,3', '2,-2', '-1,-1'] },
];

export function makeBoard(radius, rocks) {
  const blocked = new Set(rocks);
  const tiles = [];
  for (let r = -radius; r <= radius; r++) {
    for (let q = Math.max(-radius, -radius - r); q <= Math.min(radius, radius - r); q++) {
      const key = q + ',' + r;
      tiles.push({ q, r, key, blocked: blocked.has(key) });
    }
  }
  return { radius, tiles };
}

export function covers(beacon, tile) {
  const q = beacon.q - tile.q;
  const r = beacon.r - tile.r;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 1;
}

export function solve(board, selected, budget) {
  if (selected.length > budget || new Set(selected).size !== selected.length) return null;
  const tiles = board.tiles.filter(tile => !tile.blocked);
  const bits = tiles.map((_, i) => 1n << BigInt(i));
  const indices = new Map(tiles.map((tile, i) => [tile.key, i]));
  if (selected.some(key => !indices.has(key))) return null;
  const neighbors = tiles.map(beacon => tiles.flatMap((tile, i) => covers(beacon, tile) ? [i] : []));
  const masks = neighbors.map(group => group.reduce((mask, i) => mask | bits[i], 0n));
  const all = (1n << BigInt(tiles.length)) - 1n;
  const covered = selected.reduce((mask, key) => mask | masks[indices.get(key)], 0n);
  const deadEnds = new Set();

  function search(uncovered, slots) {
    if (uncovered === 0n) return [];
    if (slots === 0) return null;
    const signature = uncovered.toString(16) + '/' + slots;
    if (deadEnds.has(signature)) return null;

    // Every solution has to cover this cell. Try the most constrained cell first.
    let options;
    for (const [i, bit] of bits.entries()) {
      if (!(uncovered & bit)) continue;
      if (!options || neighbors[i].length < options.length) options = neighbors[i];
    }
    for (const index of options) {
      const tail = search(uncovered & ~masks[index], slots - 1);
      if (tail) return [tiles[index].key, ...tail];
    }
    deadEnds.add(signature);
    return null;
  }

  const extra = search(all & ~covered, budget - selected.length);
  return extra ? [...selected, ...extra] : null;
}

export function minimumBeacons(board) {
  for (let budget = 0; budget <= board.tiles.length; budget++) {
    const solution = solve(board, [], budget);
    if (solution) return solution;
  }
  throw new Error('A board must have a solution.');
}

if (typeof document !== 'undefined') {
  const byId = id => document.getElementById(id);
  const selector = byId('level');
  const stage = byId('board');
  const reading = byId('reading');
  const guidance = byId('guidance');
  const selected = new Set();
  let board, budget, suggested;

  function repaint() {
    const beacons = board.tiles.filter(tile => selected.has(tile.key));
    const open = board.tiles.filter(tile => !tile.blocked);
    let covered = 0;
    for (const [i, tile] of board.tiles.entries()) {
      const control = stage.children[i];
      const isBeacon = selected.has(tile.key);
      const isCovered = !tile.blocked && beacons.some(beacon => covers(beacon, tile));
      const state = tile.blocked ? 'blocked' : isBeacon ? 'beacon' : isCovered ? 'covered' : 'open';
      if (isCovered) covered++;
      control.dataset.state = state;
      control.dataset.hint = String(tile.key === suggested);
      control.textContent = isBeacon ? '✦' : tile.blocked ? '×' : tile.key === suggested ? '◇' : '';
      control.setAttribute('aria-label', state + ' tile ' + tile.key + (tile.key === suggested ? ', hint' : ''));
      if (!tile.blocked) control.setAttribute('aria-pressed', String(isBeacon));
    }
    reading.textContent = 'Covered ' + covered + ' of ' + open.length + ' · Beacons left ' + (budget - selected.size);
    if (covered === open.length) guidance.textContent = 'Solved with ' + selected.size + ' beacons.';
  }

  function toggle(tile) {
    guidance.textContent = '';
    suggested = undefined;
    if (selected.has(tile.key)) selected.delete(tile.key);
    else if (selected.size < budget) selected.add(tile.key);
    else guidance.textContent = 'Remove a beacon before placing another.';
    repaint();
  }

  function load(index) {
    const preset = boards[index];
    board = makeBoard(preset.radius, preset.rocks);
    budget = minimumBeacons(board).length;
    const span = 2 * preset.radius + 1;
    const rise = 1.5 * preset.radius + 1;
    selected.clear();
    suggested = undefined;
    guidance.textContent = '';
    stage.style.aspectRatio = String(Math.sqrt(3) / 2 * span / rise);
    stage.replaceChildren(...board.tiles.map(tile => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hex-cell';
      button.dataset.tile = tile.key;
      button.style.left = ((tile.q + tile.r / 2 + preset.radius + .5) * 100 / span) + '%';
      button.style.top = ((.75 * (tile.r + preset.radius) + .5) * 100 / rise) + '%';
      button.style.width = (96 / span) + '%';
      button.style.height = (96 / rise) + '%';
      button.disabled = tile.blocked;
      button.onclick = () => toggle(tile);
      return button;
    }));
    repaint();
  }

  boards.forEach((board, index) => selector.append(new Option(board.name, index)));
  selector.onchange = () => load(Number(selector.value));
  byId('reset').onclick = () => load(Number(selector.value));
  byId('hint').onclick = () => {
    const solution = solve(board, [...selected], budget);
    suggested = solution?.find(key => !selected.has(key));
    guidance.textContent = suggested ? 'Try the outlined tile.' :
      solution ? 'Every open tile is covered.' : 'Move a beacon to make room for a solution.';
    repaint();
  };
  load(0);
}
