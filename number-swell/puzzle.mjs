export const operators = ['+', '−', '×', '÷'];

export function combine(left, operator, right) {
  let value;
  switch (operator) {
    case '+': value = left.value + right.value; break;
    case '−': value = left.value - right.value; break;
    case '×': value = left.value * right.value; break;
    case '÷': value = left.value / right.value; break;
    default: return null;
  }
  if (!Number.isSafeInteger(value) || value < 1) return null;
  return {
    id: left.id | right.id,
    value,
    expression: `(${left.expression} ${operator} ${right.expression})`,
  };
}

export function makeTiles(numbers) {
  return numbers.map((value, index) => ({ id: 1 << index, value, expression: String(value) }));
}

export function applyMove(tiles, left, operator, right) {
  if (!tiles.includes(left) || !tiles.includes(right) || left === right) return null;
  const result = combine(left, operator, right);
  return result && [...tiles.filter(tile => tile !== left && tile !== right), result];
}

export function findSolution(tiles, target) {
  if (tiles.length === 1) return tiles[0].value === target ? [] : null;
  const seen = new Set();
  for (const left of tiles) {
    for (const right of tiles) {
      if (left === right) continue;
      for (const operator of operators) {
        const next = applyMove(tiles, left, operator, right);
        if (!next) continue;
        const key = next.map(tile => tile.value).sort((a, b) => a - b).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const rest = findSolution(next, target);
        if (rest) return [{ left, operator, right, result: next.at(-1) }, ...rest];
      }
    }
  }
  return null;
}

const opening = { numbers: [3, 5, 7, 9], target: 72 };
export const firstPuzzle = opening;

export function createPuzzle(previous, random = Math.random) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const numbers = Array.from({ length: 4 }, () => 2 + Math.floor(random() * 10));
    let tiles = makeTiles(numbers);
    let usedMultiply = false;
    while (tiles.length > 1) {
      const moves = [];
      for (const left of tiles) {
        for (const right of tiles) {
          if (left === right) continue;
          for (const operator of operators) {
            const next = applyMove(tiles, left, operator, right);
            if (next && next.at(-1).value <= 120) moves.push({ next, operator });
          }
        }
      }
      if (!moves.length) break;
      const move = moves[Math.floor(random() * moves.length)];
      usedMultiply ||= move.operator === '×';
      tiles = move.next;
    }
    const target = tiles[0].value;
    if (tiles.length === 1 && usedMultiply && target >= 24 && !numbers.includes(target)
        && target !== previous.target) {
      return { numbers: numbers.sort((a, b) => a - b), target };
    }
  }
  return previous.target === opening.target ? { numbers: [2, 4, 6, 8], target: 48 } : opening;
}
