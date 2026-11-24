const RANGE_DAYS = [1, 2, 3, 7];
export const MAX_RANGE_DAYS = RANGE_DAYS.at(-1);
export const DAY_SECONDS = 24 * 60 * 60;

export function formatDayRange(days) {
  return days + (days === 1 ? ' day' : ' days');
}

export function dayRangeControl(id, label, days, onChange) {
  const control = document.createElement('div');
  control.className = 'chart-control';
  const heading = document.createElement('label');
  heading.htmlFor = id;
  heading.textContent = label;
  const select = document.createElement('select');
  select.id = id;
  for (const days of RANGE_DAYS) select.append(new Option(formatDayRange(days), days));
  select.value = String(days);
  select.onchange = () => onChange(Number(select.value));
  control.append(heading, select);
  return control;
}

export function forecastWindow(hourly, days, now = Date.now() / 1000) {
  const first = hourly[0]?.time;
  const last = hourly.at(-1)?.time;
  if (!hourly.length || now > last) return { rows: [], start: now, end: now };
  const start = Math.max(first, now);
  const end = Math.min(last, start + days * DAY_SECONDS);
  return { start, end, rows: hourly.filter(row => row.time >= start && row.time <= end) };
}
