export function evolve(row, rule, wrap = false) {
  if (!Number.isInteger(rule) || rule < 0 || rule > 255 ||
      !Array.isArray(row) || !row.length || row.some(value => value !== 0 && value !== 1))
    throw Error('Use a rule from 0 to 255 and a binary row');
  const last = row.length - 1;
  return row.map((center, x) => {
    const left = x > 0 ? row[x - 1] : wrap ? row[last] : 0;
    const right = x < last ? row[x + 1] : wrap ? row[0] : 0;
    return (rule >> (4 * left + 2 * center + right)) & 1;
  });
}

export function centerSeed(text, width) {
  if (!Number.isInteger(width) || width < 1 || !/^[01]+$/.test(text) || text.length > width)
    throw Error('Enter 1 to ' + width + ' binary digits');
  const row = Array(width).fill(0);
  row.splice(Math.floor((width - text.length) / 2), text.length, ...Array.from(text, Number));
  return row;
}

if (typeof document !== 'undefined') {
  const find = id => document.getElementById(id);
  const columns = 101, generations = 71, cell = 7;
  const ctx = find('drawing').getContext('2d');
  function draw() {
    const rule = Number(find('rule').value);
    find('ruleValue').textContent = rule;
    let row;
    try {
      row = centerSeed(find('seed').value.trim(), columns);
      find('error').textContent = '';
    } catch (error) { find('error').textContent = error.message; return; }
    ctx.fillStyle = '#151824';
    ctx.fillRect(0, 0, columns * cell, generations * cell);
    let count = 0;
    for (let y = 0; y < generations; y++) {
      ctx.fillStyle = 'hsl(' + (165 + 82*y/generations) + ' 68% 72%)';
      for (let x = 0; x < columns; x++) {
        if (row[x]) { count++; ctx.fillRect(x*cell, y*cell, cell-1, cell-1); }
      }
      row = evolve(row, rule, find('edge').value === 'wrap');
    }
    find('reading').textContent = count.toLocaleString('en-US') + ' active cells over 71 rows';
    find('bits').textContent = rule.toString(2).padStart(8,'0');
  }
  for (const id of ['rule','seed','edge']) find(id).addEventListener('input', draw);
  document.querySelectorAll('[data-rule]').forEach(button => button.addEventListener('click', () => {
    find('rule').value = button.dataset.rule;
    draw();
  }));
  draw();
}
