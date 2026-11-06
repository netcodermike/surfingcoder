export function create(seed = 7) { let n = seed; const random = () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296 - .5; }; return { w: Array.from({ length: 4 }, () => [random() * 2, random() * 2]), b: [0, 0, 0, 0], v: Array.from({ length: 4 }, () => random() * 2), bias: 0, epochs: 0 }; }
const sigmoid = x => 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, x))));
export function predict(m, x) { const h = m.w.map((w, i) => Math.tanh(w[0] * x[0] + w[1] * x[1] + m.b[i])); return { h, y: sigmoid(h.reduce((a, v, i) => a + v * m.v[i], m.bias)) }; }
export function train(m, epochs = 1000, lr = .15) { const data = [[-1, -1, 0], [-1, 1, 1], [1, -1, 1], [1, 1, 0]]; let loss = 0; for (let e = 0; e < epochs; e++)
    for (const [a, b, t] of data) {
        const { h, y } = predict(m, [a, b]), delta = y - t, old = [...m.v];
        for (let i = 0; i < 4; i++) {
            m.v[i] -= lr * delta * h[i];
            const d = delta * old[i] * (1 - h[i] * h[i]);
            m.w[i][0] -= lr * d * a;
            m.w[i][1] -= lr * d * b;
            m.b[i] -= lr * d;
        }
        m.bias -= lr * delta;
    } m.epochs += epochs; for (const [a, b, t] of data) {
    const y = predict(m, [a, b]).y;
    loss -= t * Math.log(y + 1e-12) + (1 - t) * Math.log(1 - y + 1e-12);
} return loss / 4; }
