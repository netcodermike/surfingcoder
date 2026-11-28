import { emptyRun, prediction, PRESETS, sampleRound } from './model.mjs?v=1';

const get = id => document.getElementById(id);
const inputs = ['a0', 'a1', 'b0', 'b1'].map(get);
const preset = get('preset');
const percent = value => (value * 100).toFixed(1) + '%';
const integer = new Intl.NumberFormat('en-US');
const svgNamespace = 'http://www.w3.org/2000/svg';
const controls = inputs.map(input => get(input.id + '-value'));
const tables = ['alice-dial', 'bob-dial'].map(get);
let run = emptyRun();
let model;

function svg(tag, attributes, value) {
  const item = document.createElementNS(svgNamespace, tag);
  for (const [name, content] of Object.entries(attributes)) item.setAttribute(name, content);
  if (value !== undefined) item.textContent = value;
  return item;
}

function analyzer(dial, angles, active) {
  const center = 75;
  dial.replaceChildren(
    svg('circle', { cx: center, cy: center, r: 54, class: 'dial-rim' }),
    svg('circle', { cx: center, cy: center, r: 41, class: 'dial-inner' }),
    svg('line', { x1: 21, y1: 75, x2: 129, y2: 75, class: 'dial-grid' }),
    svg('line', { x1: 75, y1: 21, x2: 75, y2: 129, class: 'dial-grid' }),
    svg('text', { x: 135, y: 78, class: 'dial-tick' }, '0°'),
    svg('text', { x: 75, y: 15, class: 'dial-tick' }, '90°'),
  );
  const indices = active === 0 ? [1, 0] : [0, 1];
  for (const index of indices) {
    const theta = angles[index] * Math.PI / 180;
    const dx = Math.cos(theta), dy = -Math.sin(theta);
    const radius = index ? 42 : 55;
    dial.append(svg('line', {
      x1: center - dx * radius, y1: center - dy * radius,
      x2: center + dx * radius, y2: center + dy * radius,
      class: `dial-setting setting-${index}${active === index ? ' active' : ''}`,
    }));
    const offset = index ? -10 : 10;
    dial.append(svg('text', {
      x: center + dx * (radius - 10) - dy * offset,
      y: center + dy * (radius - 10) + dx * offset + 4,
      class: 'dial-digit',
    }, index));
  }
  dial.append(svg('circle', { cx: center, cy: center, r: 3, class: 'dial-center' }));
}

function makePairRows() {
  const body = get('pair-data');
  return model.pairs.map(({ x, y, target }) => {
    const row = body.insertRow();
    const label = document.createElement('th');
    label.scope = 'row';
    label.textContent = x + ', ' + y;
    row.append(label);
    row.insertCell().textContent = target ? 'Different' : 'Equal';
    const expected = row.insertCell();
    const sampled = row.insertCell();
    return { row, expected, sampled };
  });
}

function draw() {
  const angles = inputs.map(input => input.valueAsNumber);
  inputs.forEach((input, index) => {
    const label = angles[index] + '°';
    controls[index].value = label;
    input.setAttribute('aria-valuetext', label);
  });
  get('prediction').textContent = percent(model.win);
  get('chsh-score').textContent = model.score.toFixed(3);
  analyzer(tables[0], angles.slice(0, 2), run.latest?.x);
  analyzer(tables[1], angles.slice(2), run.latest?.y);
  get('latest-round').textContent = run.latest
    ? `Last round · Questions ${run.latest.x}, ${run.latest.y} · Answers ${run.latest.a}, ${run.latest.b} · ${run.latest.quantumWin ? 'Win' : 'Loss'}`
    : 'Run a round to see the referee’s questions and the two answers.';
  get('round-count').textContent = integer.format(run.rounds) + (run.rounds === 1 ? ' round' : ' rounds');
  for (const [mode, wins] of [['quantum', run.quantumWins], ['classical', run.classicalWins]]) {
    const result = run.rounds ? wins / run.rounds : 0;
    get(mode + '-bar').value = result;
    get(mode + '-result').value = run.rounds ? percent(result) : '—';
  }
  for (const [index, columns] of pairRows.entries()) {
    const bin = run.pairs[index];
    columns.row.classList.toggle('chosen', run.latest?.index === index);
    columns.expected.textContent = percent(model.pairs[index].win);
    columns.sampled.textContent = bin.rounds ? percent(bin.quantumWins / bin.rounds) : '—';
  }
}

function resetRun(message = '') {
  run = emptyRun();
  model = prediction(inputs.map(input => input.valueAsNumber));
  get('bell-status').textContent = message;
  draw();
}

model = prediction(inputs.map(input => input.valueAsNumber));
const pairRows = makePairRows();
draw();
for (const input of inputs) {
  input.addEventListener('input', () => {
    preset.value = 'custom';
    resetRun();
  });
}
preset.addEventListener('change', () => {
  const angles = PRESETS[preset.value];
  if (!angles) return;
  inputs.forEach((input, index) => { input.value = angles[index]; });
  resetRun('Angles loaded. Trial counts cleared.');
});
get('reset').addEventListener('click', () => resetRun('Trial counts cleared.'));
for (const button of document.querySelectorAll('[data-run]')) {
  button.addEventListener('click', () => {
    const count = Number(button.dataset.run);
    for (let i = 0; i < count; i++) sampleRound(run, model.pairs);
    draw();
    const result = `${get('round-count').textContent}. Entangled win rate ${percent(run.quantumWins / run.rounds)}. Classical win rate ${percent(run.classicalWins / run.rounds)}.`;
    get('bell-status').textContent = count === 1 ? get('latest-round').textContent + '. ' + result : result;
  });
}
