export const clockMinute = time => time.split(':').reduce((hour, minute) => Number(hour) * 60 + Number(minute));
const dayMinute = 1440;
const step = 15;
const createClock = zone => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone });
const utcTime = date => Date.parse(date + 'T00:00:00Z');
const contains = (minute, start, end) => start < end ? minute >= start && minute < end : minute >= start || minute < end;
export function windowSlots(date, zone, from, to) {
  const midnight = utcTime(date);
  const formatter = createClock(zone);
  const start = clockMinute(from), end = clockMinute(to);
  if (start === end) return Array(dayMinute / step).fill(false);
  return Array.from({ length: dayMinute / step }, (_, slot) => {
    const local = formatter.format(midnight + slot * step * 60000);
    return contains(clockMinute(local), start, end);
  });
}
export function ranges(slots) {
  const result = [];
  let start = -1;
  for (let index = 0; index <= slots.length; index++) {
    if (slots[index] && start < 0) start = index;
    if (!slots[index] && start >= 0) {
      result.push([start * step, index * step]);
      start = -1;
    }
  }
  return result;
}
const fmtUtc = minute => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');

if (typeof document !== 'undefined') {
  const get = id => document.getElementById(id);
  const zones = ['America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Halifax', 'America/Sao_Paulo',
    'Europe/London', 'Europe/Paris', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Kathmandu',
    'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'UTC'];
  for (const [id, value] of [['zone-a', zones[0]], ['zone-b', 'Europe/Paris']]) {
    get(id).append(...zones.map(zone => new Option(zone.replaceAll('_', ' '), zone)));
    get(id).value = value;
  }
  function update() {
    const date = get('date').value;
    if (!date || !get('settings').checkValidity()) {
      get('reading').textContent = 'Choose a UTC date and set start and end times in 15-minute increments.';
      for (const id of ['row-a', 'row-b', 'shared']) get(id).replaceChildren();
      get('overlap-list').replaceChildren();
      return;
    }
    const a = windowSlots(date, get('zone-a').value, get('from-a').value, get('to-a').value);
    const b = windowSlots(date, get('zone-b').value, get('from-b').value, get('to-b').value);
    const shared = a.map((value, index) => value && b[index]);
    for (const [id, data] of [['row-a', a], ['row-b', b], ['shared', shared]]) {
      const track = get(id);
      track.replaceChildren(...ranges(data).map(([start, end]) => {
        const bar = document.createElement('span');
        bar.style.left = (100 * start / dayMinute) + '%';
        bar.style.width = (100 * (end - start) / dayMinute) + '%';
        return bar;
      }));
    }
    const total = shared.filter(Boolean).length * step;
    get('reading').textContent = total ? Math.floor(total / 60) + ' h ' + total % 60 + ' min together' : 'No overlap on this UTC date';
    get('overlap-list').replaceChildren(...ranges(shared).map(([start, end]) => {
      const item = document.createElement('li');
      item.textContent = fmtUtc(start) + '–' + fmtUtc(end) + ' UTC';
      return item;
    }));
  }
  get('today').addEventListener('click', () => {
    get('date').value = new Date().toISOString().slice(0, 10);
    update();
  });
  get('settings').addEventListener('input', update);
  get('settings').addEventListener('submit', event => event.preventDefault());
  update();
}
