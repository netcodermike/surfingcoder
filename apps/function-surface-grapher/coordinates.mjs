export const seriesColors = ['#77eadd', '#d7a0fc', '#ffc189', '#96b9ff'];

export function formatValue(value, precision = 13) {
  if (!Number.isFinite(value)) return 'undefined';
  return Number(value.toPrecision(precision)).toString().replaceAll('-', '−');
}

export function axisFraction(value, min, max) {
  if (min === max) return .5;
  const span = max - min;
  return Number.isFinite(span) ? (value - min) / span :
    (value / 2 - min / 2) / (max / 2 - min / 2);
}

export function axisValue(fraction, min, max) {
  if (fraction === 0) return min;
  if (fraction === 1) return max;
  const span = max - min;
  return Number.isFinite(span) ? min + fraction * span :
    (1 - fraction) * min + fraction * max;
}

export function axisTicks(min, max, divisions = 5) {
  if (![min, max].every(Number.isFinite) || min > max) return [];
  if (min === max) return [{ value: min, text: formatValue(min) }];
  const count = Math.max(2, Math.min(10, divisions));
  const span = max - min;
  const desired = Number.isFinite(span) ? span / count : max / count - min / count;
  const unit = 10 ** Math.floor(Math.log10(desired));
  const step = [1, 2, 5, 10].map(factor => factor * unit)
    .find(candidate => candidate >= desired * (1 - 1e-14));
  const tickValues = [];
  if (Number.isFinite(step) && step > 0) {
    const start = Math.ceil(min / step);
    for (let i = 0; i < 14; i++) {
      const value = (start + i) * step;
      if (value > max) break;
      if (value >= min && value !== tickValues.at(-1)) tickValues.push(value === 0 ? 0 : value);
    }
  }
  if (tickValues.length < 2) {
    if (tickValues[0] !== min) tickValues.unshift(min);
    if (tickValues.at(-1) !== max) tickValues.push(max);
  }
  for (let precision = 7; precision <= 17; precision++) {
    const ticks = tickValues.map(value => ({ value, text: formatValue(value, precision) }));
    if (new Set(ticks.map(tick => tick.text)).size === ticks.length) return ticks;
  }
  return tickValues.map(value => ({ value, text: formatValue(value, 17) }));
}
