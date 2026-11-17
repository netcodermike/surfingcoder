export const get = id => document.getElementById(id);
export const setStatus = text => { get('status').textContent = text; };
export const make = (tag, text = '', attributes = {}) => {
  const element = document.createElement(tag);
  element.textContent = text;
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
};

export function random(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

export function shuffled(values, next) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function canvasCell(canvas, event, columns, rows) {
  const rect = canvas.getBoundingClientRect();
  return [
    Math.max(0, Math.min(columns - 1, Math.floor((event.clientX - rect.left) / rect.width * columns))),
    Math.max(0, Math.min(rows - 1, Math.floor((event.clientY - rect.top) / rect.height * rows))),
  ];
}
