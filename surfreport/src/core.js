import { ncBeaches } from './nc-beaches.js';
export { ncBeaches };
export const regions={
'North Carolina':ncBeaches.map(b=>[b.name,b.lat,b.lon]),
'US East Coast':[['Cocoa Beach, FL',28.3,-80.5],['Montauk, NY',41.03,-71.8],['Belmar, NJ',40.18,-73.95]],
'US West Coast':[['San Diego, CA',32.75,-117.3],['Huntington Beach, CA',33.61,-118.05],['Santa Cruz, CA',36.94,-122.06],['Oregon Coast',45.9,-124.1]],
'Hawaii':[['North Shore, Oahu',21.7,-158.06],['South Shore, Oahu',21.22,-157.85]],
'UK & Ireland':[['Newquay, Cornwall',50.43,-5.13],['Bundoran, Ireland',54.5,-8.3]],
'Continental Europe':[['Hossegor, France',43.67,-1.48],['Peniche, Portugal',39.34,-9.42]],
'Australia':[['Gold Coast, QLD',-28.15,153.58],['Bells Beach, VIC',-38.4,144.28]],
'New Zealand':[['Raglan',-37.82,174.77],['Piha',-36.94,174.42]],
'South Africa':[['Jeffreys Bay',-34.06,24.98],['Muizenberg',-34.14,18.5]],
'Japan':[['Chiba',35.32,140.48],['Shonan',35.29,139.44]],
'Central America':[['Tamarindo, Costa Rica',10.3,-85.89],['El Tunco, El Salvador',13.47,-89.38]],
'South America':[['Florianopolis, Brazil',-27.65,-48.38],['Pichilemu, Chile',-34.4,-72.08]]};
export function coordinates(lat, lon) {
  const coordinate = value => typeof value === 'string' && value.trim() ? Number(value) : value;
  lat = coordinate(lat);
  lon = coordinate(lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -85 || lat > 85 || lon < -180 || lon > 180) {
    throw Error('Use latitude −85 to 85 and longitude −180 to 180');
  }
  return { lat, lon };
}
const compassPoints = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function compass(degrees) {
  if (!Number.isFinite(degrees) || degrees < 0 || degrees > 360) return '—';
  return compassPoints[Math.round(degrees / 22.5) % compassPoints.length];
}
export function height(m,units){return m==null?null:m*(units==='imperial'?3.28084:1)}

const marineFields = {
  wave: 'wave_height', period: 'wave_period', direction: 'wave_direction',
  swell: 'swell_wave_height', swellPeriod: 'swell_wave_period', swellDirection: 'swell_wave_direction',
  secondary: 'secondary_swell_wave_height', secondaryPeriod: 'secondary_swell_wave_period', secondaryDirection: 'secondary_swell_wave_direction',
  tertiary: 'tertiary_swell_wave_height', tertiaryPeriod: 'tertiary_swell_wave_period', tertiaryDirection: 'tertiary_swell_wave_direction',
  windWave: 'wind_wave_height', windWavePeriod: 'wind_wave_period', windWaveDirection: 'wind_wave_direction',
};
const weatherFields = {
  speed: 'wind_speed_10m', wind_direction: 'wind_direction_10m',
  airTemperatureF: 'temperature_2m', rainChance: 'precipitation_probability',
};
const waveHeightKeys = ['wave', 'swell', 'secondary', 'tertiary', 'windWave'];

function hourlyByTime(hourly, fields) {
  const rows = new Map();
  if (!Array.isArray(hourly?.time)) return rows;
  const columns = Object.entries(fields);
  for (const [i, time] of hourly.time.entries()) {
    if (!Number.isInteger(time) || !Number.isFinite(new Date(time * 1000).getTime())) continue;
    const row = rows.get(time) ?? { time };
    // If the provider repeats an hour, retain its most recent valid values.
    for (const [key, field] of columns) {
      const sample = hourly[field]?.[i];
      if (Number.isFinite(sample) && (!waveHeightKeys.includes(key) || sample >= 0)) row[key] = sample;
      else row[key] ??= null;
    }
    rows.set(time, row);
  }
  return rows;
}

export function align(marine, weather) {
  const waves = [...hourlyByTime(marine?.hourly, marineFields).values()];
  if (!waves.some(row => waveHeightKeys.some(key => Number.isFinite(row[key])))) {
    throw Error('No marine wave heights returned for this location');
  }
  const weatherByTime = hourlyByTime(weather?.hourly, weatherFields);
  return waves.map(row => ({ ...row, ...weatherByTime.get(row.time) })).sort((a, b) => a.time - b.time);
}

export function presetForLabel(label){for(const [region,spots]of Object.entries(regions)){const index=spots.findIndex(p=>p[0]===label);if(index>=0)return {region,index,point:spots[index]}}return null}

export function distanceKm(first, second) {
  const radians = degrees => degrees * Math.PI / 180;
  const latitude = radians(first.lat);
  const otherLatitude = radians(second.lat);
  const halfChord = Math.sin((otherLatitude - latitude) / 2) ** 2 +
    Math.cos(latitude) * Math.cos(otherLatitude) * Math.sin(radians(second.lon - first.lon) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, halfChord)));
}
