const labels = ['A', 'B', 'C'];
const cubes = [];
for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) for (const c of [-1, 0, 1]) {
  const values = [a, b, c];
  const literals = values.filter(n => n >= 0).length;
  let mask = 0;
  for (let i = 0; i < 8; i++) {
    if (values.every((value, index) => value < 0 || value === ((i >> (2 - index)) & 1))) mask |= 1 << i;
  }
  const name = values.flatMap((value, index) => value === -1 ? [] : [labels[index] + (value ? '' : '′')]).join('·') || '1';
  cubes.push({ mask, literals, name });
}

export function simplify(enabled) {
  const terms = cubes.filter(cube => (cube.mask & enabled) === cube.mask);
  const best = Array(256);
  best[0] = { groups: [], cost: 0, key: '' };
  for (let mask = 0; mask <= enabled; mask++) {
    if (!best[mask] || mask === enabled) continue;
    for (const cube of terms) {
      const covered = mask | cube.mask;
      if (covered === mask) continue;
      const groups = [...best[mask].groups, cube].sort((a, b) => a.name < b.name ? -1 : Number(a.name > b.name));
      const cost = best[mask].cost + 32 + cube.literals;
      const key = groups.map(group => group.name).join(' + ');
      const earlier = best[covered];
      if (!earlier || cost < earlier.cost || (cost === earlier.cost && key < earlier.key)) {
        best[covered] = { groups, cost, key };
      }
    }
  }
  const { groups, key } = best[enabled];
  return { groups, expression: key || '0' };
}

if (typeof document !== 'undefined') {
  const get = id => document.getElementById(id);
  const palette = ['#c997f5', '#ffbd96', '#9fe2cf', '#ffd987', '#ef9ecb', '#a6bdfa', '#ece7a3', '#d9bfd3'];
  let mask = 0b11110011, active = null;
  const grid = get('map-body');
  const bits = i => i.toString(2).padStart(3, '0');
  const buttons = [];
  for (const row of [0, 1]) {
    const tr = grid.insertRow();
    const th = document.createElement('th');
    th.scope = 'row'; th.textContent = row;
    tr.append(th);
    for (const column of [0, 1, 3, 2]) {
      const cell = tr.insertCell();
      const minterm = row * 4 + column;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.term = minterm;
      const value = document.createElement('strong');
      const hint = document.createElement('small');
      hint.textContent = bits(minterm);
      button.append(value, hint);
      button.addEventListener('click', () => {
        active = null;
        mask ^= 1 << minterm;
        render();
      });
      buttons[minterm] = button;
      cell.append(button);
    }
  }
  function render() {
    const { groups, expression } = simplify(mask);
    get('reading').textContent = 'F = ' + expression;
    get('summary').textContent = groups.length ? groups.length + (groups.length === 1 ? ' product term' : ' product terms') : 'All minterms are zero';
    buttons.forEach((button, i) => {
      const selected = Boolean(mask & (1 << i));
      const memberships = groups.flatMap((group, index) => group.mask & (1 << i) ? [index] : []);
      button.setAttribute('aria-label', 'Minterm ' + bits(i));
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('highlighted', active !== null && memberships.includes(active));
      button.firstElementChild.textContent = selected ? '1' : '0';
      button.style.borderBottomColor = memberships.length ? palette[memberships[0]] : '';
    });
    get('terms').replaceChildren(...groups.map(({ name, mask: covered }, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.style.borderColor = palette[index];
      button.textContent = name + ' (' + buttons.flatMap((_, i) => (covered & (1 << i)) ? [bits(i)] : []).join(', ') + ')';
      button.setAttribute('aria-pressed', String(active === index));
      button.addEventListener('click', () => {
        active = active === index ? null : index;
        render();
        get('terms').children[index].focus();
      });
      return button;
    }));
  }
  get('clear').addEventListener('click', () => { mask = 0; active = null; render(); });
  get('example').addEventListener('click', () => { mask = 0b11110011; active = null; render(); });
  render();
}
