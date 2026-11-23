const MINUTE = 60_000;
const DAY = 1440 * MINUTE;
const RADIANS_PER_DEGREE = Math.PI / 180;
const SUNRISE_ZENITH = 90.833 * RADIANS_PER_DEGREE;

export function daylightIntervals(start, end, station) {
  const { lat, lon } = station ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];

  const latitude = lat * RADIANS_PER_DEGREE;
  const longitudeOffset = lon * 4 * MINUTE;
  const intervals = [];
  const firstDay = Math.floor((start + longitudeOffset) / DAY) * DAY;
  // Check the adjoining solar days as sunrise and sunset can cross midnight UTC.
  for (let day = firstDay - DAY; day <= end + longitudeOffset + DAY; day += DAY) {
    const year = new Date(day).getUTCFullYear();
    const yearStart = Date.UTC(year, 0, 1);
    // NOAA's fractional-year solar position approximation.
    // https://gml.noaa.gov/grad/solcalc/solareqns.PDF
    const angle = 2 * Math.PI * (day - yearStart) / (Date.UTC(year + 1, 0, 1) - yearStart);
    const timeCorrection = 229.18 * (0.000075 + 0.001868 * Math.cos(angle) - 0.032077 * Math.sin(angle)
      - 0.014615 * Math.cos(2 * angle) - 0.040849 * Math.sin(2 * angle));
    const declination = 0.006918 - 0.399912 * Math.cos(angle) + 0.070257 * Math.sin(angle)
      - 0.006758 * Math.cos(2 * angle) + 0.000907 * Math.sin(2 * angle)
      - 0.002697 * Math.cos(3 * angle) + 0.00148 * Math.sin(3 * angle);

    const hourAngleCosine = (Math.cos(SUNRISE_ZENITH) - Math.sin(latitude) * Math.sin(declination))
      / (Math.cos(latitude) * Math.cos(declination));
    if (hourAngleCosine >= 1) continue;
    const continuousDaylight = hourAngleCosine <= -1;
    const solarNoon = day - longitudeOffset + (720 - timeCorrection) * MINUTE;
    const halfDaylight = Math.acos(Math.max(-1, hourAngleCosine)) / RADIANS_PER_DEGREE * 4 * MINUTE;
    const rise = Math.max(start, continuousDaylight ? day - longitudeOffset : solarNoon - halfDaylight);
    const set = Math.min(end, continuousDaylight ? day + DAY - longitudeOffset : solarNoon + halfDaylight);
    if (rise >= set) continue;
    const previous = intervals.at(-1);
    if (previous && rise <= previous.end) previous.end = Math.max(previous.end, set);
    else intervals.push({ start: rise, end: set });
  }
  return intervals;
}
