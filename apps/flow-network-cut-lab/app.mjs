const edges = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3]];

export function maxFlow(capacities) {
  const residual = Array.from({ length: 4 }, () => Array(4).fill(0));
  edges.forEach(([from, to], index) => { residual[from][to] = capacities[index]; });
  let total = 0;
  while (true) {
    const parent = [-1, -1, -1, -1];
    parent[0] = 0;
    const queue = [0];
    for (let index = 0; index < queue.length; index++) {
      const from = queue[index];
      for (let to = 0; to < 4; to++) {
        if (parent[to] === -1 && residual[from][to] > 0) {
          parent[to] = from;
          queue.push(to);
        }
      }
    }
    if (parent[3] === -1) {
      const flows = edges.map(([from, to], index) => capacities[index] - residual[from][to]);
      const cut = edges.flatMap(([from, to], index) => parent[from] !== -1 && parent[to] === -1 ? [index] : []);
      return { total, flows, cut, sourceSide: queue };
    }
    let increment = Infinity;
    for (let to = 3; to !== 0; to = parent[to]) increment = Math.min(increment, residual[parent[to]][to]);
    for (let to = 3; to !== 0; to = parent[to]) {
      residual[parent[to]][to] -= increment;
      residual[to][parent[to]] += increment;
    }
    total += increment;
  }
}

if (typeof document !== 'undefined') {
  const context = document.querySelector('canvas').getContext('2d');
  const positions = [[108, 205], [380, 87], [380, 320], [652, 205]];
  const labels = ['Source', 'A', 'B', 'Sink'];
  const inputs = [...document.querySelectorAll('#settings input')];

  function render() {
    const capacities = inputs.map(input => Number(input.value));
    const { total, flows, cut, sourceSide } = maxFlow(capacities);
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.font = 'bold 20px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const [index, [from, to]] of edges.entries()) {
      const [ax, ay] = positions[from], [bx, by] = positions[to];
      const length = Math.hypot(bx - ax, by - ay);
      const dx = (bx - ax) / length, dy = (by - ay) / length;
      const tipX = bx - dx * 45, tipY = by - dy * 45;
      const color = cut.includes(index) ? '#ffbd7c' : '#a58bc9';
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = cut.includes(index) ? 4 : 2.5;
      context.beginPath(); context.moveTo(ax, ay); context.lineTo(tipX, tipY); context.stroke();
      context.beginPath(); context.moveTo(tipX, tipY);
      context.lineTo(tipX - dx * 15 - dy * 6, tipY - dy * 15 + dx * 6);
      context.lineTo(tipX - dx * 15 + dy * 6, tipY - dy * 15 - dx * 6);
      context.closePath(); context.fill();
      context.fillText(`${flows[index]} / ${capacities[index]}`, (ax + bx) / 2 - dy * 24, (ay + by) / 2 + dx * 24);
      document.querySelector(`#${inputs[index].id}-value`).textContent = capacities[index];
    }
    for (const [index, [x, y]] of positions.entries()) {
      context.fillStyle = sourceSide.includes(index) ? '#39786b' : '#563e76';
      context.strokeStyle = '#d7bee9';
      context.lineWidth = 2;
      context.beginPath(); context.arc(x, y, 44, 0, 2 * Math.PI); context.fill(); context.stroke();
      context.fillStyle = '#fbf0ff'; context.fillText(labels[index], x, y);
    }
    document.querySelector('#reading').textContent = `Maximum flow ${total} · minimum cut capacity ${cut.reduce((sum, i) => sum + capacities[i], 0)}`;
    document.querySelector('#cut').textContent = cut.length
      ? `Cut edges ${cut.map(index => edges[index].map(node => labels[node]).join(' → ')).join(', ')}`
      : 'The cut has no outgoing edges.';
  }
  document.querySelector('#settings').addEventListener('input', render);
  render();
}
