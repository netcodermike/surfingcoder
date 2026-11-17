import { canvasCell, get, make, random, setStatus } from '../../assets/game-editions.mjs';

const board = get('board'), ctx = board.getContext('2d');
const width = 72, height = 36, side = 10;
const biomes = {
  Ocean: ['#30699d', 'Glowing plankton', 'Sea fog'],
  Ice: ['#d4cfff', 'Crystal lichens', 'Snowfall'],
  Mountain: ['#936c9b', 'Cloud moss', 'Gentle rain'],
  Desert: ['#d5a769', 'Burrowing beetles', 'Dust storm'],
  Forest: ['#5aa990', 'Fern grazers', 'Gentle rain'],
};
let sectors, cursor = [36, 18], seed;

function generate() {
  seed = Number(get('seed').value) >>> 0;
  const next = random(seed);
  const [a, b, c] = [next(), next(), next()].map(value => value * Math.PI * 2);
  sectors = Array.from({ length: width * height }, (_, i) => {
    const lon = (i % width) * Math.PI / 36;
    const lat = (Math.floor(i / width) - 18) * Math.PI / 36;
    const elevation = Math.sin(lon * 3 + a) * Math.cos(lat * 4 + b) * .30 +
      Math.cos(lon * 7 + c) * Math.cos(lat * 6) * .12 + Math.sin(lat * 9 + a) * .12;
    const warmth = Math.cos(lat) - Math.max(elevation, 0) * .6;
    let kind = 'Forest';
    if (elevation < -.08) kind = 'Ocean';
    else if (warmth < .35) kind = 'Ice';
    else if (elevation > .3) kind = 'Mountain';
    else if (warmth > .8 && Math.sin(lon + a) > .3) kind = 'Desert';
    return kind;
  });
  render();
  setStatus('Planet ' + seed + ' generated. Select a sector to explore.');
}

function render() {
  sectors.forEach((kind, i) => {
    ctx.fillStyle = biomes[kind][0];
    ctx.fillRect(i % width * side, Math.floor(i / width) * side, side, side);
  });
  const [x, y] = cursor;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x * side + .5, y * side + .5, side - 1, side - 1);
  const kind = sectors[y * width + x];
  const [, life, weather] = biomes[kind];
  get('sector').replaceChildren(...[
    ['Sector', (x + 1) + ' · ' + (y + 1)], ['Biome', kind], ['Life', life], ['Weather', weather],
  ].flatMap(([label, value]) => [make('dt', label), make('dd', value)]));
  board.setAttribute('aria-label', 'Sector ' + (x + 1) + ', ' + (y + 1) + ': ' + kind + ', ' + life + ', ' + weather);
}

get('generator').onsubmit = event => { event.preventDefault(); generate(); };
get('random').onclick = () => { get('seed').value = crypto.getRandomValues(new Uint32Array(1))[0]; generate(); };
board.onclick = event => { cursor = canvasCell(board, event, width, height); render(); };
board.onkeydown = event => {
  const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key];
  if (!delta) return;
  event.preventDefault();
  cursor = [(cursor[0] + delta[0] + width) % width, Math.max(0, Math.min(height - 1, cursor[1] + delta[1]))];
  render();
};
get('download').onclick = () => {
  const pixels = sectors.map((kind, i) => '<rect x="' + i % width + '" y="' + Math.floor(i / width) + '" width="1" height="1" fill="' + biomes[kind][0] + '"/>');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36" width="720" height="360" shape-rendering="crispEdges">' + pixels.join('') + '</svg>';
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const link = make('a', '', { href: url, download: 'planet-' + seed + '.svg' });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
generate();
