export const CLASSICAL_LIMIT = 3 / 4;
export const QUANTUM_LIMIT = (2 + Math.SQRT2) / 4;
export const SETTINGS = [[0, 0], [0, 1], [1, 0], [1, 1]];
export const PRESETS = {
  optimal: [0, 45, 22.5, -22.5],
  aligned: [0, 0, 0, 0],
  inverted: [0, 45, -22.5, 22.5],
};

export function prediction([a0, a1, b0, b1]) {
  const alice = [a0, a1], bob = [b0, b1];
  const pairs = SETTINGS.map(([x, y]) => {
    const target = x & y;
    const correlation = Math.cos((alice[x] - bob[y]) * Math.PI / 90);
    const same = (1 + correlation) / 2;
    return { x, y, target, correlation, same, win: target ? 1 - same : same };
  });
  const score = pairs.reduce((sum, pair) => sum + (pair.target ? -pair.correlation : pair.correlation), 0);
  return { pairs, score, win: 0.5 + score / 8 };
}

export function emptyRun() {
  return {
    rounds: 0, quantumWins: 0, classicalWins: 0, latest: null,
    pairs: SETTINGS.map(() => ({ rounds: 0, quantumWins: 0, classicalWins: 0 })),
  };
}

export function sampleRound(run, pairs, random = Math.random) {
  const index = Math.floor(random() * pairs.length);
  const { x, y, target, same } = pairs[index];
  const a = random() < 0.5 ? 0 : 1;
  const b = random() < same ? a : 1 - a;
  const quantumWin = (a ^ b) === target;
  const classicalWin = target === 0;
  const row = run.pairs[index];
  row.rounds++;
  row.quantumWins += quantumWin;
  row.classicalWins += classicalWin;
  run.rounds++;
  run.quantumWins += quantumWin;
  run.classicalWins += classicalWin;
  run.latest = { index, x, y, a, b, quantumWin };
}
