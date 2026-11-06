export function energy(items, rate, days = 30) { if (!Number.isFinite(rate) || rate < 0 || !Number.isInteger(days) || days < 1 || days > 366)
    throw Error('Nonnegative tariff and 1–366 days required'); const rows = items.map(p => { if (!p.name || ![p.watts, p.hours, p.count].every(Number.isFinite) || p.watts < 0 || p.hours < 0 || p.hours > 24 || p.count < 1 || !Number.isInteger(p.count))
    throw Error('Use name, nonnegative watts, 0–24 hours, positive integer count'); const kwh = p.watts / 1000 * p.hours * p.count * days; return { ...p, kwh, cost: kwh * rate }; }); return { rows, kwh: rows.reduce((s, r) => s + r.kwh, 0), cost: rows.reduce((s, r) => s + r.cost, 0) }; }
export function parse(text) { return text.trim().split('\n').map(line => { const p = line.split(','); if (p.length !== 4 || p.slice(1).some(v => !v.trim()))
    throw Error('Each row: name,watts,hours-per-day,count'); return { name: p[0].trim(), watts: Number(p[1]), hours: Number(p[2]), count: Number(p[3]) }; }); }
