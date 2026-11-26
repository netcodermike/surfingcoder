const step = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const deflection = {"/": [1, 0, 3, 2], "\\": [3, 2, 1, 0]};
const key = (x, y) => x + "," + y;
export const levels = [
  {width: 6, height: 6, source: [0, 4], receiver: [5, 1], mirrors: {"2,4": "\\", "2,1": "\\"}},
  {width: 7, height: 6, source: [0, 5], receiver: [6, 4], mirrors: {"2,5": "/", "2,1": "\\", "4,1": "/", "4,4": "/"}},
];

export function traceBeam({width, height, source, receiver}, mirrors, direction = 1) {
  let [x, y] = source;
  const path = [source];
  const seen = new Set();
  while (true) {
    const state = key(x, y) + "," + direction;
    if (seen.has(state)) return {path, outcome: "loop"};
    seen.add(state);
    const [dx, dy] = step[direction];
    x += dx;
    y += dy;
    if (x < 0 || x >= width || y < 0 || y >= height) return {path, outcome: "edge"};
    path.push([x, y]);
    if (x === receiver[0] && y === receiver[1]) return {path, outcome: "lit"};
    const mirror = mirrors[key(x, y)];
    if (mirror) direction = deflection[mirror][direction];
  }
}

if (typeof document !== "undefined") {
  const board = document.querySelector("#mirror-board");
  const level = document.querySelector("#level");
  const reading = document.querySelector("#reading");
  let current;
  let mirrors;
  let tiles;
  function draw() {
    const {path, outcome} = traceBeam(current, mirrors);
    const selected = new Set(path.map(([x, y]) => key(x, y)));
    for (const [position, tile] of tiles) {
      tile.dataset.lit = selected.has(position);
      if (mirrors[position]) {
        tile.textContent = mirrors[position];
        tile.setAttribute("aria-label", "Mirror at " + position + ", angled " + (mirrors[position] === "/" ? "forward" : "back"));
      }
    }
    reading.textContent = {lit: "Beacon lit!", edge: "The beam exits the board.", loop: "The beam is caught in a loop."}[outcome];
  }
  function reset() {
    current = levels[Number(level.value)];
    mirrors = {...current.mirrors};
    tiles = new Map();
    board.style.setProperty("--columns", current.width);
    board.replaceChildren();
    for (let y = 0; y < current.height; y++) {
      for (let x = 0; x < current.width; x++) {
        const position = key(x, y);
        const tile = document.createElement(mirrors[position] ? "button" : "span");
        tile.className = "mirror-tile";
        if (mirrors[position]) {
          tile.type = "button";
          tile.addEventListener("click", () => {
            mirrors[position] = mirrors[position] === "/" ? "\\" : "/";
            draw();
          });
        } else if (position === current.source.join(",")) {
          tile.textContent = "→";
          tile.setAttribute("aria-label", "Beam source");
        } else if (position === current.receiver.join(",")) {
          tile.textContent = "✦";
          tile.setAttribute("aria-label", "Beacon");
        }
        tiles.set(position, tile);
        board.append(tile);
      }
    }
    draw();
  }
  document.querySelector("#reset").addEventListener("click", reset);
  level.addEventListener("change", reset);
  reset();
}
