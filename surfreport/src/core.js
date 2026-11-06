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
export function coordinates(lat,lon){lat=Number(lat);lon=Number(lon);if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -85||lat>85||lon < -180||lon>180)throw Error('Use latitude −85 to 85 and longitude −180 to 180');return {lat,lon}}
export function compass(deg){return deg==null?'—':['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(((deg%360)+360)%360/22.5)%16]}
export function height(m,units){return m==null?null:m*(units==='imperial'?3.28084:1)}
export function align(marine,weather){if(!marine?.hourly?.time?.length)throw Error('No marine forecast returned for this location');const wind=new Map((weather?.hourly?.time||[]).map((t,i)=>[t,{speed:weather.hourly.wind_speed_10m?.[i],wind_direction:weather.hourly.wind_direction_10m?.[i]}]));return marine.hourly.time.map((time,i)=>({time,wave:marine.hourly.wave_height?.[i]??null,period:marine.hourly.wave_period?.[i]??null,direction:marine.hourly.wave_direction?.[i]??null,swell:marine.hourly.swell_wave_height?.[i]??null,swellPeriod:marine.hourly.swell_wave_period?.[i]??null,...(wind.get(time)||{})}))}

export function presetForLabel(label){for(const [region,spots]of Object.entries(regions)){const index=spots.findIndex(p=>p[0]===label);if(index>=0)return {region,index,point:spots[index]}}return null}
